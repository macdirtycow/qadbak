import ActivityKit
import Foundation

struct QadbakJobAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var detail: String
        var progress: Double
        var phase: String
    }

    var domain: String
    var jobKind: String
}

enum LiveActivityManager {
    @MainActor
    static func start(domain: String, kind: String, title: String, detail: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        endAll()
        let attrs = QadbakJobAttributes(domain: domain, jobKind: kind)
        let state = QadbakJobAttributes.ContentState(
            title: title,
            detail: detail,
            progress: 0.1,
            phase: "running"
        )
        _ = try? Activity.request(
            attributes: attrs,
            content: .init(state: state, staleDate: nil),
            pushType: nil
        )
    }

    @MainActor
    static func update(title: String, detail: String, progress: Double, phase: String = "running") {
        let state = QadbakJobAttributes.ContentState(
            title: title,
            detail: detail,
            progress: min(max(progress, 0), 1),
            phase: phase
        )
        Task {
            for activity in Activity<QadbakJobAttributes>.activities {
                await activity.update(.init(state: state, staleDate: nil))
            }
        }
    }

    @MainActor
    static func end(success: Bool, message: String) {
        let state = QadbakJobAttributes.ContentState(
            title: success ? "Completed" : "Failed",
            detail: message,
            progress: 1,
            phase: success ? "done" : "error"
        )
        Task {
            for activity in Activity<QadbakJobAttributes>.activities {
                await activity.end(
                    .init(state: state, staleDate: nil),
                    dismissalPolicy: .default
                )
            }
        }
    }

    @MainActor
    static func endAll() {
        Task {
            for activity in Activity<QadbakJobAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}

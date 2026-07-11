import ActivityKit
import SwiftUI
import WidgetKit

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

struct QadbakLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: QadbakJobAttributes.self) { context in
            VStack(alignment: .leading, spacing: 6) {
                Text(context.state.title)
                    .font(.headline)
                Text(context.attributes.domain)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(context.state.detail)
                    .font(.caption2)
                    .lineLimit(2)
                ProgressView(value: context.state.progress)
            }
            .padding(12)
            .activityBackgroundTint(Color(red: 15/255, green: 20/255, blue: 25/255))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.phase == "done" ? "checkmark.circle.fill" : "gearshape.2.fill")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.caption.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.detail)
                        .font(.caption2)
                        .lineLimit(2)
                }
            } compactLeading: {
                Image(systemName: "q.circle.fill")
            } compactTrailing: {
                Text("\(Int(context.state.progress * 100))%")
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: "q.circle.fill")
            }
        }
    }
}

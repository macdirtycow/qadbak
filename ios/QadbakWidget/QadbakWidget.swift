import WidgetKit
import SwiftUI

private struct CachedWidgetSummary: Codable {
    let domainCount: Int
    let sslExpiringSoon: Int
    let backupStale: Int
    let urgentActions: Int
    let topDomain: String?
    let updatedAt: Date
}

struct QadbakWidgetEntry: TimelineEntry {
    let date: Date
    let domainCount: Int
    let sslExpiringSoon: Int
    let urgentActions: Int
    let topDomain: String?
}

struct QadbakWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> QadbakWidgetEntry {
        QadbakWidgetEntry(
            date: .now,
            domainCount: 4,
            sslExpiringSoon: 1,
            urgentActions: 2,
            topDomain: "example.com"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (QadbakWidgetEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QadbakWidgetEntry>) -> Void) {
        let entry = loadEntry()
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now.addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func loadEntry() -> QadbakWidgetEntry {
        guard let defaults = UserDefaults(suiteName: "group.com.qadbak.panel"),
              let data = defaults.data(forKey: "widgetSummary"),
              let cached = try? JSONDecoder().decode(CachedWidgetSummary.self, from: data) else {
            return QadbakWidgetEntry(date: .now, domainCount: 0, sslExpiringSoon: 0, urgentActions: 0, topDomain: nil)
        }
        return QadbakWidgetEntry(
            date: cached.updatedAt,
            domainCount: cached.domainCount,
            sslExpiringSoon: cached.sslExpiringSoon,
            urgentActions: cached.urgentActions,
            topDomain: cached.topDomain
        )
    }
}

struct QadbakWidgetView: View {
    let entry: QadbakWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "globe")
                Text("Qadbak")
                    .font(.headline)
            }
            Text("\(entry.domainCount) domain\(entry.domainCount == 1 ? "" : "s")")
                .font(.title2.weight(.semibold))
            if entry.sslExpiringSoon > 0 {
                Label("\(entry.sslExpiringSoon) SSL expiring", systemImage: "lock.trianglebadge.exclamationmark")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            if entry.urgentActions > 0 {
                Label("\(entry.urgentActions) actions", systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            if let top = entry.topDomain {
                Text(top)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding()
    }
}

struct QadbakWidget: Widget {
    let kind = "QadbakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QadbakWidgetProvider()) { entry in
            QadbakWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Qadbak")
        .description("Domain count and SSL alerts from your panel.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

import WidgetKit
import SwiftUI

private enum WidgetColors {
    static let bg = Color(red: 15/255, green: 20/255, blue: 25/255)
    static let card = Color(red: 26/255, green: 35/255, blue: 50/255)
    static let text = Color(red: 241/255, green: 245/255, blue: 249/255)
    static let muted = Color(red: 148/255, green: 163/255, blue: 184/255)
    static let glow = Color(red: 99/255, green: 102/255, blue: 241/255)
    static let warning = Color(red: 251/255, green: 191/255, blue: 36/255)
    static let danger = Color(red: 248/255, green: 113/255, blue: 113/255)
}

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
        QadbakWidgetEntry(date: .now, domainCount: 4, sslExpiringSoon: 1, urgentActions: 2, topDomain: "example.com")
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
        ZStack {
            WidgetColors.bg
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "q.circle.fill")
                        .foregroundStyle(WidgetColors.text)
                    Text("Qadbak")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(WidgetColors.text)
                }
                Text("\(entry.domainCount)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetColors.text)
                Text(entry.domainCount == 1 ? "domain" : "domains")
                    .font(.caption)
                    .foregroundStyle(WidgetColors.muted)
                if entry.sslExpiringSoon > 0 {
                    Label("\(entry.sslExpiringSoon) SSL expiring", systemImage: "lock.trianglebadge.exclamationmark")
                        .font(.caption2)
                        .foregroundStyle(WidgetColors.warning)
                }
                if entry.urgentActions > 0 {
                    Label("\(entry.urgentActions) actions", systemImage: "exclamationmark.circle")
                        .font(.caption2)
                        .foregroundStyle(WidgetColors.danger)
                }
                if let top = entry.topDomain {
                    Text(top)
                        .font(.caption2)
                        .foregroundStyle(WidgetColors.muted)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(14)
        }
    }
}

struct QadbakWidget: Widget {
    let kind = "QadbakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QadbakWidgetProvider()) { entry in
            QadbakWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetColors.bg
                }
        }
        .configurationDisplayName("Qadbak")
        .description("Domain count and SSL alerts from your panel.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

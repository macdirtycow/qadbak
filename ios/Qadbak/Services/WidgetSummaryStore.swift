import Foundation

enum WidgetSummaryStore {
    static let appGroupId = "group.com.qadbak.panel"
    private static let key = "widgetSummary"

    struct CachedSummary: Codable {
        let domainCount: Int
        let sslExpiringSoon: Int
        let backupStale: Int
        let urgentActions: Int
        let topDomain: String?
        let updatedAt: Date
    }

    static func save(_ summary: WidgetSummary) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        let cached = CachedSummary(
            domainCount: summary.domainCount,
            sslExpiringSoon: summary.sslExpiringSoon,
            backupStale: summary.backupStale,
            urgentActions: summary.urgentActions,
            topDomain: summary.domains?.first?.domain,
            updatedAt: Date()
        )
        if let data = try? JSONEncoder().encode(cached) {
            defaults.set(data, forKey: key)
        }
    }

    static func load() -> CachedSummary? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let data = defaults.data(forKey: key),
              let cached = try? JSONDecoder().decode(CachedSummary.self, from: data) else {
            return nil
        }
        return cached
    }
}

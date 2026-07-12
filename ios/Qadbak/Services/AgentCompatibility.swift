import Foundation

enum AgentCompatibility {
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    static func isAtLeast(_ version: String, required: String) -> Bool {
        compare(version, required) != .orderedAscending
    }

    static func ensureAppMeetsRequirement(_ minimum: String?) throws {
        guard let minimum, !minimum.isEmpty else { return }
        guard isAtLeast(appVersion, required: minimum) else {
            throw APIError.message("Update the Qadbak app to \(minimum) or newer before pairing.")
        }
    }

    static func ensureAgentMeetsRequirement(_ agentVersion: String, minimum: String?) throws {
        guard let minimum, !minimum.isEmpty else { return }
        guard isAtLeast(agentVersion, required: minimum) else {
            throw APIError.message("Agent version \(agentVersion) is below the required \(minimum). Reinstall from the app.")
        }
    }

    private static func compare(_ lhs: String, _ rhs: String) -> ComparisonResult {
        let a = parse(lhs)
        let b = parse(rhs)
        for i in 0 ..< max(a.count, b.count) {
            let av = i < a.count ? a[i] : 0
            let bv = i < b.count ? b[i] : 0
            if av < bv { return .orderedAscending }
            if av > bv { return .orderedDescending }
        }
        return .orderedSame
    }

    private static func parse(_ version: String) -> [Int] {
        version
            .split(whereSeparator: { $0 == "." || $0 == "-" || $0 == "+" })
            .prefix(4)
            .map { part in
                Int(part.filter(\.isNumber)) ?? 0
            }
    }
}

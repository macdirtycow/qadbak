import Foundation

struct SavedServer: Codable, Identifiable, Hashable {
    let id: String
    var label: String
    var serverURL: String
    var username: String?
    var lastUsedAt: Date

    var displayHost: String {
        URL(string: serverURL)?.host ?? serverURL
    }

    var subtitle: String {
        if let username, !username.isEmpty {
            return "\(username) · \(displayHost)"
        }
        return displayHost
    }
}

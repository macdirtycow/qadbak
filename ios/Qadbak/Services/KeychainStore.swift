import Foundation
import Security

/// Secure per-server credential storage using the iOS Keychain.
final class KeychainStore {
    private let service = "com.qadbak.panel"

    // MARK: - Server profiles

    func loadServers() -> [SavedServer] {
        guard let data = loadData(key: "savedServers"),
              let servers = try? JSONDecoder().decode([SavedServer].self, from: data) else {
            return []
        }
        return servers.sorted { $0.lastUsedAt > $1.lastUsedAt }
    }

    func saveServers(_ servers: [SavedServer]) {
        guard let data = try? JSONEncoder().encode(servers) else { return }
        saveData(key: "savedServers", data: data, secure: false)
    }

    func loadActiveServerId() -> String? {
        load(key: "activeServerId")
    }

    func saveActiveServerId(_ id: String?) {
        if let id {
            save(key: "activeServerId", value: id, secure: false)
        } else {
            delete(key: "activeServerId")
        }
    }

    // MARK: - Per-server refresh tokens (device-only, requires unlock)

    func saveRefreshToken(_ token: String, serverId: String) {
        save(key: tokenKey(serverId), value: token, secure: true)
    }

    func loadRefreshToken(serverId: String) -> String? {
        load(key: tokenKey(serverId), secure: true)
    }

    func deleteRefreshToken(serverId: String) {
        delete(key: tokenKey(serverId))
    }

    func hasRefreshToken(serverId: String) -> Bool {
        loadRefreshToken(serverId: serverId) != nil
    }

    func migrateSecureTokensIfNeeded() {
        for server in loadServers() {
            guard let token = loadRefreshToken(serverId: server.id) else { continue }
            saveRefreshToken(token, serverId: server.id)
        }
    }

    // MARK: - Migration from single-server storage

    func migrateLegacyIfNeeded() -> SavedServer? {
        guard loadServers().isEmpty else { return nil }
        guard let rawURL = load(key: "serverURL"),
              let url = URL(string: rawURL),
              let token = load(key: "refreshToken", secure: true) ?? load(key: "refreshToken", secure: false) else {
            return nil
        }
        let server = SavedServer(
            id: UUID().uuidString,
            label: url.host ?? "Panel",
            serverURL: url.absoluteString,
            username: load(key: "username", secure: false),
            lastUsedAt: Date()
        )
        saveServers([server])
        saveActiveServerId(server.id)
        saveRefreshToken(token, serverId: server.id)
        delete(key: "serverURL")
        delete(key: "refreshToken")
        delete(key: "username")
        return server
    }

    // MARK: - Keychain primitives

    private func tokenKey(_ serverId: String) -> String {
        "refreshToken.\(serverId)"
    }

    private func save(key: String, value: String, secure: Bool) {
        saveData(key: key, data: Data(value.utf8), secure: secure)
    }

    private func saveData(key: String, data: Data, secure: Bool) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = secure
            ? kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            : kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    private func load(key: String, secure: Bool = false) -> String? {
        guard let data = loadData(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func loadData(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return data
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

import Foundation
import Security

/// Secure per-server credential storage using the iOS Keychain.
final class KeychainStore {
    private let service = "com.qadbak.panel"

    // MARK: - Managed server profiles

    func loadManagedServers() -> [ManagedServer] {
        migrateToManagedServersIfNeeded()
        guard let data = loadData(key: "managedServers"),
              let servers = try? JSONDecoder().decode([ManagedServer].self, from: data) else {
            return []
        }
        return servers.sorted { $0.lastUsedAt > $1.lastUsedAt }
    }

    func saveManagedServers(_ servers: [ManagedServer]) {
        guard let data = try? JSONEncoder().encode(servers) else { return }
        saveData(key: "managedServers", data: data, secure: false)
    }

    /// Legacy API — returns managed servers (SavedServer is embedded in ManagedServer).
    func loadServers() -> [ManagedServer] {
        loadManagedServers()
    }

    func saveServers(_ servers: [ManagedServer]) {
        saveManagedServers(servers)
    }

    func migrateToManagedServersIfNeeded() {
        guard loadData(key: "managedServers") == nil else { return }
        if let legacyData = loadData(key: "savedServers"),
           let legacy = try? JSONDecoder().decode([SavedServer].self, from: legacyData) {
            let migrated = legacy.map { $0.toManagedServer() }
            saveManagedServers(migrated)
            return
        }
        _ = migrateLegacyIfNeeded()
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

    // MARK: - Panel refresh tokens

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

    // MARK: - Agent tokens & pins (never UserDefaults)

    func saveAgentRefreshToken(_ token: String, serverId: String) {
        save(key: "agentRefreshToken.\(serverId)", value: token, secure: true)
    }

    func loadAgentRefreshToken(serverId: String) -> String? {
        load(key: "agentRefreshToken.\(serverId)", secure: true)
    }

    func deleteAgentRefreshToken(serverId: String) {
        delete(key: "agentRefreshToken.\(serverId)")
    }

    func hasAgentSession(serverId: String) -> Bool {
        loadAgentRefreshToken(serverId: serverId) != nil
    }

    func saveAgentTlsPin(_ sha256: String, serverId: String) {
        save(key: "agentTlsPin.\(serverId)", value: sha256, secure: true)
    }

    func loadAgentTlsPin(serverId: String) -> String? {
        load(key: "agentTlsPin.\(serverId)", secure: true)
    }

    func saveSshHostKeyFingerprint(_ fingerprint: String, serverId: String) {
        save(key: "sshHostKey.\(serverId)", value: fingerprint, secure: true)
    }

    func loadSshHostKeyFingerprint(serverId: String) -> String? {
        load(key: "sshHostKey.\(serverId)", secure: true)
    }

    func migrateSecureTokensIfNeeded() {
        for server in loadManagedServers() {
            if server.isQadbakPanel, let token = loadRefreshToken(serverId: server.id) {
                saveRefreshToken(token, serverId: server.id)
            }
        }
    }

    // MARK: - Migration from single-server storage

    @discardableResult
    func migrateLegacyIfNeeded() -> ManagedServer? {
        guard loadData(key: "managedServers") == nil, loadData(key: "savedServers") == nil else {
            return nil
        }
        guard let rawURL = load(key: "serverURL"),
              let url = URL(string: rawURL),
              let token = load(key: "refreshToken", secure: true) ?? load(key: "refreshToken", secure: false) else {
            return nil
        }
        let server = ManagedServer.qadbakPanel(
            label: url.host ?? "Panel",
            serverURL: url.absoluteString,
            username: load(key: "username", secure: false)
        )
        saveManagedServers([server])
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

import Foundation
import Security

final class KeychainStore {
    private let service = "com.qadbak.panel"

    func saveServerURL(_ url: URL) {
        save(key: "serverURL", value: url.absoluteString)
    }

    func loadServerURL() -> URL? {
        guard let raw = load(key: "serverURL") else { return nil }
        return URL(string: raw)
    }

    func saveRefreshToken(_ token: String) {
        save(key: "refreshToken", value: token)
    }

    func loadRefreshToken() -> String? {
        load(key: "refreshToken")
    }

    func deleteRefreshToken() {
        delete(key: "refreshToken")
    }

    func saveUsername(_ username: String) {
        save(key: "username", value: username)
    }

    func loadUsername() -> String? {
        load(key: "username")
    }

    private func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    private func load(key: String) -> String? {
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
        return String(data: data, encoding: .utf8)
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

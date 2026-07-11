import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class AppState {
    var serverURL: URL?
    var accessToken: String?
    var username: String?
    var role: String?
    var domains: [String] = []
    var capabilities: MobileCapabilities?
    var isLoading = false
    var errorMessage: String?
    var requiresUnlock = false
    var pendingPushDomain: String?

    private let keychain = KeychainStore()
    private(set) var api: QadbakAPI?

    var isClientAccount: Bool {
        role == "client"
    }

    var clientOwnDomainsOnly: Bool {
        capabilities?.clientOwnDomainsOnly == true
    }

    var webmailEnabled: Bool {
        capabilities?.webmail ?? true
    }

    var filesEnabled: Bool {
        capabilities?.files ?? true
    }

    var isSignedIn: Bool {
        accessToken != nil && serverURL != nil
    }

    func lock() {
        requiresUnlock = true
    }

    func unlock() {
        requiresUnlock = false
    }

    func handlePushNavigation(domain: String?) {
        pendingPushDomain = domain
    }

    init() {
        restoreSession()
    }

    func restoreSession() {
        if let saved = keychain.loadServerURL(),
           let normalized = try? Self.normalizePanelURL(saved.absoluteString),
           normalized != saved {
            serverURL = normalized
            keychain.saveServerURL(normalized)
        } else {
            serverURL = keychain.loadServerURL()
        }
        guard let base = serverURL,
              let refresh = keychain.loadRefreshToken() else {
            return
        }
        serverURL = base
        api = QadbakAPI(baseURL: base, tokenProvider: { [weak self] in
            self?.accessToken
        }, onTokensRefreshed: { [weak self] access, refresh in
            self?.accessToken = access
            self?.keychain.saveRefreshToken(refresh)
            self?.api?.setRefreshToken(refresh)
        })
        api?.setRefreshToken(refresh)
        Task { await bootstrapFromRefresh(refreshToken: refresh) }
    }

    func configureServer(_ urlString: String) throws {
        serverURL = try Self.normalizePanelURL(urlString)
        keychain.saveServerURL(serverURL!)
        api = QadbakAPI(baseURL: serverURL!, tokenProvider: { [weak self] in
            self?.accessToken
        }, onTokensRefreshed: { [weak self] access, refresh in
            self?.accessToken = access
            self?.keychain.saveRefreshToken(refresh)
            self?.api?.setRefreshToken(refresh)
        })
    }

    func checkPanelConnection() async throws -> String {
        guard let api else { throw APIError.message("Set your panel URL first.") }
        return try await api.healthSummary()
    }

    /// Accepts pasted panel URLs like `https://qadbak.com/login` and keeps only the origin.
    static func normalizePanelURL(_ urlString: String) throws -> URL {
        var trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            throw APIError.message("Enter your panel URL.")
        }
        if !trimmed.contains("://") {
            trimmed = "https://" + trimmed
        }
        guard var components = URLComponents(string: trimmed), let host = components.host, !host.isEmpty else {
            throw APIError.message("Enter a valid panel URL (e.g. https://qadbak.com).")
        }
        let scheme = components.scheme?.lowercased() == "http" ? "http" : "https"
        components.scheme = scheme
        // www → apex: nginx 301 on www breaks POST (login API); always use canonical host.
        if host.lowercased().hasPrefix("www.") {
            components.host = String(host.dropFirst(4))
        } else {
            components.host = host
        }
        components.port = components.port
        components.path = ""
        components.query = nil
        components.fragment = nil
        components.user = nil
        components.password = nil
        guard let normalized = components.url else {
            throw APIError.message("Enter a valid panel URL.")
        }
        return normalized
    }

    func login(username: String, password: String) async throws {
        guard let api else { throw APIError.message("Set your panel URL first.") }
        let trimmedUser = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPass = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedUser.isEmpty, !trimmedPass.isEmpty else {
            throw APIError.message("Enter username and password.")
        }
        isLoading = true
        errorMessage = nil
        accessToken = nil
        keychain.deleteRefreshToken()
        api.setRefreshToken(nil)
        defer { isLoading = false }
        let device = UIDevice.current.name
        let result = try await api.login(username: trimmedUser, password: trimmedPass, deviceLabel: device)
        if let totpToken = result.totpChallengeToken {
            throw APIError.totpRequired(loginToken: totpToken)
        }
        guard result.accessToken != nil else {
            throw APIError.message(result.serverError ?? "Sign-in failed. Check username, password, and panel URL.")
        }
        applySession(result)
        if let refresh = result.refreshToken {
            keychain.saveRefreshToken(refresh)
            api.setRefreshToken(refresh)
        }
        if let username = result.username {
            keychain.saveUsername(username)
        }
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
    }

    func completeTotp(loginToken: String, code: String) async throws {
        guard let api else { throw APIError.message("Set your panel URL first.") }
        let trimmedCode = code.replacingOccurrences(of: " ", with: "")
        guard trimmedCode.count >= 6 else {
            throw APIError.message("Enter the 6-digit authenticator code.")
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let device = UIDevice.current.name
        let result = try await api.loginTotp(loginToken: loginToken, totp: trimmedCode, deviceLabel: device)
        if let totpToken = result.totpChallengeToken {
            throw APIError.totpRequired(loginToken: totpToken)
        }
        guard result.accessToken != nil else {
            throw APIError.message(result.serverError ?? "Two-factor verification failed. Try again.")
        }
        applySession(result)
        if let refresh = result.refreshToken {
            keychain.saveRefreshToken(refresh)
            api.setRefreshToken(refresh)
        }
        if let username = result.username {
            keychain.saveUsername(username)
        } else if let saved = keychain.loadUsername() {
            username = saved
        }
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
    }

    func logout() async {
        if let api, let token = accessToken, let refresh = keychain.loadRefreshToken() {
            try? await api.logout(accessToken: token, refreshToken: refresh)
        }
        await PushNotificationService.shared.unregisterFromServer()
        clearSession()
    }

    func clearSession() {
        accessToken = nil
        username = nil
        role = nil
        domains = []
        capabilities = nil
        keychain.deleteRefreshToken()
    }

    private func applySession(_ result: LoginResponse) {
        accessToken = result.accessToken
        username = result.username
        role = result.role
        domains = result.domains ?? []
    }

    func refreshSessionInfo() async {
        guard let api else { return }
        do {
            let me = try await api.me()
            username = me.username
            role = me.role
            domains = me.domains
            capabilities = me.capabilities
            let summary = try await api.widgetSummary()
            WidgetSummaryStore.save(summary)
        } catch {
            // Non-fatal on foreground refresh.
        }
    }

    private func bootstrapFromRefresh(refreshToken: String) async {
        guard let api else { return }
        do {
            let result = try await api.refresh(refreshToken: refreshToken)
            guard !isSignedIn else { return }
            applySession(result)
            if let refresh = result.refreshToken {
                keychain.saveRefreshToken(refresh)
                api.setRefreshToken(refresh)
            }
            await refreshSessionInfo()
            await PushNotificationService.shared.requestAuthorizationAndRegister()
        } catch {
            if !isSignedIn {
                clearSession()
            }
        }
    }
}

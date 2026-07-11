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

    private let keychain = KeychainStore()
    private(set) var api: QadbakAPI?

    var isClientAccount: Bool {
        role == "client"
    }

    var clientOwnDomainsOnly: Bool {
        capabilities?.clientOwnDomainsOnly == true
    }

    var webmailEnabled: Bool {
        capabilities?.webmail != false
    }

    var isSignedIn: Bool {
        accessToken != nil && serverURL != nil
    }

    init() {
        restoreSession()
    }

    func restoreSession() {
        guard let base = keychain.loadServerURL(),
              let refresh = keychain.loadRefreshToken() else {
            serverURL = keychain.loadServerURL()
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
        var trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            throw APIError.message("Enter your panel URL.")
        }
        if !trimmed.contains("://") {
            trimmed = "https://" + trimmed
        }
        guard let parsed = URL(string: trimmed), let host = parsed.host else {
            throw APIError.message("Enter a valid panel URL (https://panel.example.com).")
        }
        var components = URLComponents()
        components.scheme = parsed.scheme == "http" ? "http" : "https"
        components.host = host
        components.port = parsed.port
        guard let normalized = components.url else {
            throw APIError.message("Enter a valid panel URL.")
        }
        serverURL = normalized
        keychain.saveServerURL(normalized)
        api = QadbakAPI(baseURL: normalized, tokenProvider: { [weak self] in
            self?.accessToken
        }, onTokensRefreshed: { [weak self] access, refresh in
            self?.accessToken = access
            self?.keychain.saveRefreshToken(refresh)
            self?.api?.setRefreshToken(refresh)
        })
    }

    func login(username: String, password: String) async throws {
        guard let api else { throw APIError.message("Set your panel URL first.") }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let device = UIDevice.current.name
        let result = try await api.login(username: username, password: password, deviceLabel: device)
        if result.requiresTotp == true {
            throw APIError.totpRequired(loginToken: result.loginToken ?? "")
        }
        applySession(result)
        if let refresh = result.refreshToken {
            keychain.saveRefreshToken(refresh)
            api.setRefreshToken(refresh)
        }
        keychain.saveUsername(username)
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
    }

    func completeTotp(loginToken: String, code: String) async throws {
        guard let api else { throw APIError.message("Set your panel URL first.") }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let device = UIDevice.current.name
        let result = try await api.loginTotp(loginToken: loginToken, totp: code, deviceLabel: device)
        applySession(result)
        if let refresh = result.refreshToken {
            keychain.saveRefreshToken(refresh)
            api.setRefreshToken(refresh)
        }
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
    }

    func logout() async {
        if let api, let token = accessToken, let refresh = keychain.loadRefreshToken() {
            try? await api.logout(accessToken: token, refreshToken: refresh)
        }
        clearSession()
    }

    func clearSession() {
        accessToken = nil
        username = nil
        role = nil
        domains = []
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
        isLoading = true
        defer { isLoading = false }
        do {
            let result = try await api.refresh(refreshToken: refreshToken)
            applySession(result)
            if let refresh = result.refreshToken {
                keychain.saveRefreshToken(refresh)
                api.setRefreshToken(refresh)
            }
            await refreshSessionInfo()
        } catch {
            clearSession()
        }
    }
}

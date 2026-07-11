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
    var savedServers: [SavedServer] = []
    var activeServerId: String?
    var addingNewServer = false

    private var backgroundSince: Date?
    private var lastUnlockedAt: Date?
    private let lockAfterBackgroundSeconds: TimeInterval = 45

    private let keychain = KeychainStore()
    private(set) var api: QadbakAPI?

    var activeServer: SavedServer? {
        guard let activeServerId else { return nil }
        return savedServers.first(where: { $0.id == activeServerId })
    }

    var isClientAccount: Bool {
        role == "client"
    }

    var clientOwnDomainsOnly: Bool {
        capabilities?.clientOwnDomainsOnly == true
    }

    var webmailEnabled: Bool {
        capabilities?.webmail ?? false
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
        lastUnlockedAt = Date()
    }

    func noteEnteredBackground() {
        backgroundSince = Date()
    }

    func noteEnteredForeground() {
        defer { backgroundSince = nil }
        guard isSignedIn, let since = backgroundSince else { return }
        let away = Date().timeIntervalSince(since)
        guard away >= lockAfterBackgroundSeconds else { return }
        if let last = lastUnlockedAt, Date().timeIntervalSince(last) < 10 { return }
        requiresUnlock = true
    }

    func handlePushNavigation(domain: String?) {
        pendingPushDomain = domain
    }

    func hasStoredSession(for server: SavedServer) -> Bool {
        keychain.hasRefreshToken(serverId: server.id)
    }

    init() {
        reloadServers()
        keychain.migrateSecureTokensIfNeeded()
        restoreSession()
    }

    func reloadServers() {
        _ = keychain.migrateLegacyIfNeeded()
        savedServers = keychain.loadServers()
        activeServerId = keychain.loadActiveServerId() ?? savedServers.first?.id
    }

    func restoreSession() {
        reloadServers()
        guard let server = activeServer ?? savedServers.first else { return }
        Task { try? await activateServer(server, bootstrap: true) }
    }

    func configureServer(_ urlString: String) throws {
        serverURL = try Self.normalizePanelURL(urlString)
        api = makeAPI(for: serverURL!)
    }

    func prepareAddServer() async {
        addingNewServer = true
        if isSignedIn {
            await logout()
        }
        serverURL = nil
        accessToken = nil
        username = nil
        role = nil
        domains = []
        capabilities = nil
        api = nil
    }

    func switchToServer(_ server: SavedServer) async throws {
        addingNewServer = false
        if activeServerId == server.id, isSignedIn { return }
        if isSignedIn {
            await PushNotificationService.shared.unregisterFromServer()
            clearSession(keepServerEntry: true)
        }
        try await activateServer(server, bootstrap: true)
        if !isSignedIn {
            throw APIError.message("No saved session for \(server.label). Sign in once to store it securely.")
        }
    }

    func removeServer(_ server: SavedServer) async {
        if activeServerId == server.id {
            await logout()
        }
        keychain.deleteRefreshToken(serverId: server.id)
        var next = keychain.loadServers().filter { $0.id != server.id }
        keychain.saveServers(next)
        savedServers = next
        if activeServerId == server.id {
            activeServerId = next.first?.id
            keychain.saveActiveServerId(activeServerId)
            if let first = next.first {
                try? await activateServer(first, bootstrap: true)
            }
        }
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

    func login(username: String, password: String, serverLabel: String? = nil) async throws {
        guard let api, let serverURL else { throw APIError.message("Set your panel URL first.") }
        let trimmedUser = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPass = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedUser.isEmpty, !trimmedPass.isEmpty else {
            throw APIError.message("Enter username and password.")
        }
        isLoading = true
        errorMessage = nil
        accessToken = nil
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
        try persistServerSession(
            serverURL: serverURL,
            username: result.username ?? trimmedUser,
            refreshToken: result.refreshToken,
            label: serverLabel
        )
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
        addingNewServer = false
    }

    func completeTotp(loginToken: String, code: String, serverLabel: String? = nil) async throws {
        guard let api, let serverURL else { throw APIError.message("Set your panel URL first.") }
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
        try persistServerSession(
            serverURL: serverURL,
            username: result.username ?? username,
            refreshToken: result.refreshToken,
            label: serverLabel
        )
        await refreshSessionInfo()
        await PushNotificationService.shared.requestAuthorizationAndRegister()
        addingNewServer = false
    }

    func logout() async {
        if let api, let token = accessToken, let serverId = activeServerId,
           let refresh = keychain.loadRefreshToken(serverId: serverId) {
            try? await api.logout(accessToken: token, refreshToken: refresh)
        }
        await PushNotificationService.shared.unregisterFromServer()
        clearSession(keepServerEntry: true)
    }

    func clearSession(keepServerEntry: Bool = false) {
        accessToken = nil
        username = nil
        role = nil
        domains = []
        capabilities = nil
        if !keepServerEntry, let serverId = activeServerId {
            keychain.deleteRefreshToken(serverId: serverId)
        }
        api?.setRefreshToken(nil)
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
            touchActiveServer(username: me.username)
        } catch {
            // Non-fatal on foreground refresh.
        }
    }

    // MARK: - Private

    private func makeAPI(for base: URL) -> QadbakAPI {
        QadbakAPI(baseURL: base, tokenProvider: { [weak self] in
            self?.accessToken
        }, onTokensRefreshed: { [weak self] access, refresh in
            guard let self else { return }
            self.accessToken = access
            if let serverId = self.activeServerId {
                self.keychain.saveRefreshToken(refresh, serverId: serverId)
            }
            self.api?.setRefreshToken(refresh)
        })
    }

    private func activateServer(_ server: SavedServer, bootstrap: Bool) async throws {
        let url = try Self.normalizePanelURL(server.serverURL)
        serverURL = url
        activeServerId = server.id
        keychain.saveActiveServerId(server.id)
        api = makeAPI(for: url)
        username = server.username

        guard bootstrap, let refresh = keychain.loadRefreshToken(serverId: server.id) else { return }
        api?.setRefreshToken(refresh)
        await bootstrapFromRefresh(refreshToken: refresh)
    }

    private func persistServerSession(
        serverURL: URL,
        username: String?,
        refreshToken: String?,
        label: String?
    ) throws {
        let host = serverURL.host ?? "Panel"
        let existing = savedServers.first(where: {
            ($0.serverURL == serverURL.absoluteString) || ($0.displayHost == host)
        })
        let serverId = existing?.id ?? UUID().uuidString
        let profile = SavedServer(
            id: serverId,
            label: label?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? existing?.label ?? host,
            serverURL: serverURL.absoluteString,
            username: username,
            lastUsedAt: Date()
        )
        upsertServer(profile)
        activeServerId = serverId
        keychain.saveActiveServerId(serverId)
        if let refreshToken {
            keychain.saveRefreshToken(refreshToken, serverId: serverId)
            api?.setRefreshToken(refreshToken)
        }
    }

    private func upsertServer(_ profile: SavedServer) {
        var next = keychain.loadServers().filter { $0.id != profile.id }
        next.insert(profile, at: 0)
        keychain.saveServers(next)
        savedServers = next.sorted { $0.lastUsedAt > $1.lastUsedAt }
    }

    private func touchActiveServer(username: String?) {
        guard let id = activeServerId else { return }
        var next = keychain.loadServers()
        guard let idx = next.firstIndex(where: { $0.id == id }) else { return }
        next[idx].lastUsedAt = Date()
        if let username, !username.isEmpty {
            next[idx].username = username
        }
        keychain.saveServers(next)
        savedServers = next.sorted { $0.lastUsedAt > $1.lastUsedAt }
    }

    private func applySession(_ result: LoginResponse) {
        accessToken = result.accessToken
        username = result.username
        role = result.role
        domains = result.domains ?? []
    }

    private func bootstrapFromRefresh(refreshToken: String) async {
        guard let api else { return }
        do {
            let result = try await api.refresh(refreshToken: refreshToken)
            guard !isSignedIn else { return }
            applySession(result)
            if let refresh = result.refreshToken, let serverId = activeServerId {
                keychain.saveRefreshToken(refresh, serverId: serverId)
                api.setRefreshToken(refresh)
            }
            await refreshSessionInfo()
            await PushNotificationService.shared.requestAuthorizationAndRegister()
        } catch {
            if !isSignedIn {
                clearSession(keepServerEntry: true)
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

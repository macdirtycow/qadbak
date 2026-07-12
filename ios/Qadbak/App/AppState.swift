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
    var license: MobileLicenseInfo?
    var isLoading = false
    var errorMessage: String?
    var requiresUnlock = false
    var pendingPushDomain: String?
    var savedServers: [ManagedServer] = []
    var activeServerId: String?
    var addingNewServer = false
    var addServerMode: AddServerMode?

    enum AddServerMode {
        case qadbakPanel
        case linuxSSH
    }

    private var backgroundSince: Date?
    private var lastUnlockedAt: Date?
    private let lockAfterBackgroundSeconds: TimeInterval = 45

    private let keychain = KeychainStore()
    private(set) var api: QadbakAPI?
    private(set) var hostingAPI: (any DomainHostingAPI)?
    private(set) var activeProvider: (any ServerManagementProvider)?
    private var agentClient: AgentAPIClient?

    var activeServer: ManagedServer? {
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

    var premiumPlanLabel: String? {
        license?.displayPlan
    }

    var premiumActive: Bool {
        license?.premiumActive == true
    }

    var isAdmin: Bool {
        role == "admin"
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

    func hasStoredSession(for server: ManagedServer) -> Bool {
        if server.isQadbakPanel {
            return keychain.hasRefreshToken(serverId: server.id)
        }
        if server.isAgentManaged {
            return keychain.hasAgentSession(serverId: server.id)
        }
        return false
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

    func resetConnectionChoice() async {
        addServerMode = nil
        await prepareAddServer()
    }

    func prepareAddServer(mode: AddServerMode? = nil) async {
        addingNewServer = mode != nil
        addServerMode = mode
        if isSignedIn {
            await logout()
        }
        serverURL = nil
        accessToken = nil
        username = nil
        role = nil
        domains = []
        capabilities = nil
        license = nil
        api = nil
        hostingAPI = nil
        activeProvider = nil
    }

    func switchToServer(_ server: ManagedServer) async throws {
        addingNewServer = false
        if activeServerId == server.id {
            if server.isQadbakPanel && isSignedIn { return }
            if server.isAgentManaged { return }
        }
        if isSignedIn {
            await PushNotificationService.shared.unregisterFromServer()
            clearSession(keepServerEntry: true)
        }
        try await activateServer(server, bootstrap: true)
        if server.isAgentManaged {
            return
        }
        if !isSignedIn {
            throw APIError.message("No saved session for \(server.displayName). Sign in once to store it securely.")
        }
    }

    func removeServer(_ server: ManagedServer) async {
        if server.isAgentManaged, let client = makeAgentClient(for: server) {
            try? await client.revoke()
        }
        if activeServerId == server.id {
            await logout()
        }
        keychain.deleteRefreshToken(serverId: server.id)
        keychain.deleteAgentRefreshToken(serverId: server.id)
        var next = keychain.loadManagedServers().filter { $0.id != server.id }
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
        license = nil
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
            license = me.license
            let summary = try await api.widgetSummary()
            WidgetSummaryStore.save(summary)
            touchActiveServer(username: me.username)
        } catch {
            // Non-fatal on foreground refresh.
        }
    }

    var showsDomainHosting: Bool {
        if activeServer?.isQadbakPanel == true {
            return isSignedIn
        }
        if let server = activeServer, server.isAgentManaged {
            return server.capabilities.domainHosting && hasStoredSession(for: server)
        }
        return false
    }

    var showsAgentPanelShell: Bool {
        guard let server = activeServer, server.isAgentManaged else { return false }
        guard hasStoredSession(for: server) else { return false }
        return server.capabilities.domainHosting || server.capabilities.panelApps
    }

    var showsAgentDashboard: Bool {
        guard let server = activeServer else { return false }
        guard server.isAgentManaged && server.authenticationMethod == .agentToken else { return false }
        guard hasStoredSession(for: server) else { return false }
        return !showsAgentPanelShell
    }

    var canManageDomains: Bool {
        hostingAPI != nil
    }

    func refreshActiveServerCapabilities() async {
        guard let server = activeServer, server.isAgentManaged,
              let client = makeAgentClient(for: server) else { return }
        do {
            let res = try await client.capabilities()
            if let caps = res.capabilities?.toServerCapabilities() {
                var updated = server
                updated.capabilities = caps
                updateServerProfileIfExists(updated)
                refreshHostingAdapter(for: updated)
            }
        } catch {
            // Non-fatal.
        }
    }

    func updateActiveServerProfile(_ profile: ManagedServer) {
        upsertServer(profile)
    }

    func updateServerProfileIfExists(_ profile: ManagedServer) {
        guard savedServers.contains(where: { $0.id == profile.id }) else { return }
        upsertServer(profile)
    }

    func makeAgentClient(for server: ManagedServer) -> AgentAPIClient? {
        guard server.isAgentManaged, hasStoredSession(for: server) else { return nil }
        return makeAgentClient(for: server, accessToken: nil)
    }

    var hasAgentServers: Bool {
        savedServers.contains { $0.isAgentManaged && $0.authenticationMethod == .agentToken }
    }

    func registerAgentServer(
        _ server: ManagedServer,
        accessToken: String,
        refreshToken: String,
        tlsFingerprint: String,
        sshHostKeyFingerprint: String? = nil
    ) async throws {
        keychain.saveAgentRefreshToken(refreshToken, serverId: server.id)
        keychain.saveAgentTlsPin(tlsFingerprint, serverId: server.id)
        if let sshHostKeyFingerprint, !sshHostKeyFingerprint.isEmpty {
            keychain.saveSshHostKeyFingerprint(sshHostKeyFingerprint, serverId: server.id)
        }
        upsertServer(server)
        activeServerId = server.id
        keychain.saveActiveServerId(server.id)
        agentClient = makeAgentClient(for: server, accessToken: accessToken)
        agentClient?.setAccessToken(accessToken)
        refreshHostingAdapter(for: server)
        activeProvider = ServerProviderFactory.makeProvider(
            for: server,
            api: nil,
            agentClient: agentClient,
            keychain: keychain
        )
        addingNewServer = false
        addServerMode = nil
    }

    var showsAgentPlaceholder: Bool {
        guard let server = activeServer else { return false }
        return server.isAgentManaged && server.authenticationMethod == .agentTokenPendingPair
    }

    private func refreshHostingAdapter(for server: ManagedServer) {
        if let api {
            hostingAPI = QadbakDomainHostingAdapter(api: api)
            return
        }
        if server.isAgentManaged, server.capabilities.domainHosting {
            let client = agentClient ?? makeAgentClient(for: server, accessToken: nil)
            hostingAPI = AgentPanelHostingAPI(client: client)
            return
        }
        hostingAPI = nil
    }

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

    private func activateServer(_ server: ManagedServer, bootstrap: Bool) async throws {
        activeServerId = server.id
        keychain.saveActiveServerId(server.id)
        username = server.username
        activeProvider = nil

        if server.isQadbakPanel {
            let url = try Self.normalizePanelURL(server.apiBaseURL)
            serverURL = url
            api = makeAPI(for: url)
            hostingAPI = QadbakDomainHostingAdapter(api: api!)
            activeProvider = ServerProviderFactory.makeProvider(
                for: server,
                api: api,
                agentClient: agentClient,
                keychain: keychain
            )

            guard bootstrap, let refresh = keychain.loadRefreshToken(serverId: server.id) else { return }
            api?.setRefreshToken(refresh)
            await bootstrapFromRefresh(refreshToken: refresh)
            return
        }

        if server.isAgentManaged {
            serverURL = nil
            accessToken = nil
            api = nil
            hostingAPI = nil
            if server.authenticationMethod == .agentToken {
                agentClient = makeAgentClient(for: server, accessToken: nil)
                refreshHostingAdapter(for: server)
                activeProvider = ServerProviderFactory.makeProvider(
                    for: server,
                    api: nil,
                    agentClient: agentClient,
                    keychain: keychain
                )
                if bootstrap, keychain.loadAgentRefreshToken(serverId: server.id) != nil {
                    await bootstrapAgentFromRefresh(server: server)
                }
            } else {
                agentClient = nil
            }
            return
        }

        throw APIError.message("Unsupported server type.")
    }

    private func persistServerSession(
        serverURL: URL,
        username: String?,
        refreshToken: String?,
        label: String?
    ) throws {
        let host = serverURL.host ?? "Panel"
        let existing = savedServers.first(where: {
            ($0.apiBaseURL == serverURL.absoluteString) || ($0.displayHost == host)
        })
        let serverId = existing?.id ?? UUID().uuidString
        let profile = ManagedServer.qadbakPanel(
            id: serverId,
            label: label?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? existing?.displayName ?? host,
            serverURL: serverURL.absoluteString,
            username: username,
            lastUsedAt: Date()
        )
        var online = profile
        online.connectionStatus = .online
        upsertServer(online)
        activeServerId = serverId
        keychain.saveActiveServerId(serverId)
        if let refreshToken {
            keychain.saveRefreshToken(refreshToken, serverId: serverId)
            api?.setRefreshToken(refreshToken)
        }
    }

    private func upsertServer(_ profile: ManagedServer) {
        var next = keychain.loadManagedServers().filter { $0.id != profile.id }
        next.insert(profile, at: 0)
        keychain.saveManagedServers(next)
        savedServers = next.sorted { $0.lastUsedAt > $1.lastUsedAt }
        if let server = savedServers.first(where: { $0.id == profile.id }) {
            activeProvider = ServerProviderFactory.makeProvider(
                for: server,
                api: api,
                agentClient: agentClient,
                keychain: keychain
            )
            if server.id == activeServerId {
                refreshHostingAdapter(for: server)
            }
        }
    }

    private func makeAgentClient(for server: ManagedServer, accessToken: String?) -> AgentAPIClient {
        let base = URL(string: server.apiBaseURL) ?? AgentInstallService.makeAgentBaseURL(
            host: server.hostname,
            port: server.agentPort ?? 9443
        )
        let pin = keychain.loadAgentTlsPin(serverId: server.id)
        let serverId = server.id
        return AgentAPIClient(
            baseURL: base,
            pinnedFingerprint: pin,
            accessToken: accessToken,
            refreshTokenProvider: { [keychain] in keychain.loadAgentRefreshToken(serverId: serverId) },
            onTokensRefreshed: { [weak self] access, refresh in
                guard let self else { return }
                self.agentClient?.setAccessToken(access)
                self.keychain.saveAgentRefreshToken(refresh, serverId: serverId)
            }
        )
    }

    private func bootstrapAgentFromRefresh(server: ManagedServer) async {
        guard let client = agentClient else { return }
        do {
            let res = try await client.rotate()
            if res.accessToken != nil {
                var updated = server
                updated.connectionStatus = .online
                updated.lastSeen = Date()
                if let caps = try? await client.capabilities().capabilities?.toServerCapabilities() {
                    updated.capabilities = caps
                }
                upsertServer(updated)
                refreshHostingAdapter(for: updated)
            }
        } catch {
            var failed = server
            failed.connectionStatus = .authFailed
            upsertServer(failed)
        }
    }

    private func touchActiveServer(username: String?) {
        guard let id = activeServerId else { return }
        var next = keychain.loadManagedServers()
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

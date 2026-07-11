import Foundation

@MainActor
final class QadbakAPI {
    private let baseURL: URL
    private let onTokensRefreshed: (String, String) -> Void
    private var refreshToken: String?
    private lazy var client = APIClient(
        baseURL: baseURL,
        tokenProvider: tokenProvider,
        refreshHandler: { [weak self] in
            try await self?.performRefresh()
        }
    )
    private let tokenProvider: () -> String?

    init(
        baseURL: URL,
        tokenProvider: @escaping () -> String?,
        onTokensRefreshed: @escaping (String, String) -> Void
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.onTokensRefreshed = onTokensRefreshed
    }

    func setRefreshToken(_ token: String?) {
        refreshToken = token
    }

    private func performRefresh() async throws {
        guard let refreshToken else { throw APIError.unauthorized }
        let result: LoginResponse = try await unauthenticatedClient.request(
            "POST",
            path: "/api/auth/mobile/refresh",
            body: RefreshBody(refreshToken: refreshToken),
            authorized: false
        )
        guard let access = result.accessToken, let refresh = result.refreshToken else {
            throw APIError.unauthorized
        }
        self.refreshToken = refresh
        onTokensRefreshed(access, refresh)
    }

    private var unauthenticatedClient: APIClient {
        APIClient(baseURL: baseURL, tokenProvider: { nil }, refreshHandler: {})
    }

    func login(username: String, password: String, deviceLabel: String) async throws -> LoginResponse {
        try await unauthenticatedClient.request(
            "POST",
            path: "/api/auth/mobile",
            body: LoginBody(username: username, password: password, deviceLabel: deviceLabel),
            authorized: false
        )
    }

    func healthSummary() async throws -> String {
        struct Health: Decodable { let ok: Bool?; let mock: Bool? }
        let health: Health = try await unauthenticatedClient.request("GET", path: "/api/health", authorized: false)
        guard health.ok == true else {
            throw APIError.message("Panel health check failed.")
        }
        let mode = health.mock == true ? "demo/mock" : "live"
        return "Connected (\(mode))"
    }

    func loginTotp(loginToken: String, totp: String, deviceLabel: String) async throws -> LoginResponse {
        try await unauthenticatedClient.request(
            "POST",
            path: "/api/auth/mobile",
            body: TotpBody(loginToken: loginToken, totp: totp, deviceLabel: deviceLabel),
            authorized: false
        )
    }

    func refresh(refreshToken: String) async throws -> LoginResponse {
        self.refreshToken = refreshToken
        return try await unauthenticatedClient.request(
            "POST",
            path: "/api/auth/mobile/refresh",
            body: RefreshBody(refreshToken: refreshToken),
            authorized: false
        )
    }

    func logout(accessToken: String, refreshToken: String) async throws {
        guard let url = URL(string: "/api/auth/mobile/logout", relativeTo: baseURL) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(LogoutBody(refreshToken: refreshToken))
        _ = try await URLSession.shared.data(for: req)
    }

    func me() async throws -> SessionInfo {
        try await client.request("GET", path: "/api/mobile/v1/me")
    }

    func listDomains() async throws -> [HostedDomain] {
        let res: DomainsListResponse = try await client.request("GET", path: "/api/domains")
        return res.domains
    }

    func domainDetail(_ domain: String) async throws -> DomainDetailResponse {
        try await client.request("GET", path: domainPath(domain))
    }

    func websiteHealth(_ domain: String) async throws -> WebsiteHealthReport {
        try await client.request("GET", path: domainPath(domain, "/website-health"))
    }

    func repairWebsite(_ domain: String) async throws -> RepairWebsiteResponse {
        try await client.request("POST", path: domainPath(domain, "/repair-website"))
    }

    func websiteLogs(_ domain: String, type: String) async throws -> WebsiteLogsResponse {
        try await client.request(
            "GET",
            path: domainPath(domain, "/logs", query: [URLQueryItem(name: "type", value: type)])
        )
    }

    func listDns(_ domain: String) async throws -> [DnsRecord] {
        let res: DnsResponse = try await client.request("GET", path: domainPath(domain, "/dns"))
        return res.records ?? []
    }

    func addDns(_ domain: String, record: DnsRecord) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/dns"),
            body: record
        )
    }

    func deleteDns(_ domain: String, record: DnsRecord) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/dns"),
            body: record
        )
    }

    func listMailUsers(_ domain: String) async throws -> [MailUser] {
        let res: MailUsersResponse = try await client.request("GET", path: domainPath(domain, "/users"))
        return res.users ?? []
    }

    func listMailFolders(_ domain: String, user: String) async throws -> [ImapMailbox] {
        let res: MailFoldersResponse = try await client.request(
            "GET",
            path: domainPath(domain, "/mailboxes", query: [URLQueryItem(name: "user", value: user)])
        )
        return res.mailboxes ?? []
    }

    func listSsl(_ domain: String) async throws -> [SslCert] {
        let res: SslListResponse = try await client.request("GET", path: domainPath(domain, "/ssl"))
        return res.certs ?? []
    }

    func renewSsl(_ domain: String, host: String? = nil) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/ssl"),
            body: SslRenewBody(host: host ?? domain)
        )
    }

    func listBackups(_ domain: String) async throws -> BackupsResponse {
        try await client.request("GET", path: domainPath(domain, "/backups"))
    }

    func startBackup(_ domain: String) async throws {
        let _: OkResponse = try await client.request("POST", path: domainPath(domain, "/backups"))
    }

    func widgetSummary() async throws -> WidgetSummary {
        try await client.request("GET", path: "/api/mobile/v1/widgets/summary")
    }

    func registerPushToken(_ token: String, bundleId: String?, deviceLabel: String?) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: "/api/mobile/v1/push/register",
            body: PushRegisterBody(token: token, bundleId: bundleId, deviceLabel: deviceLabel)
        )
    }

    func unregisterPushToken(_ token: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: "/api/mobile/v1/push/register",
            body: PushUnregisterBody(token: token)
        )
    }

    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing {
        try await client.request(
            "GET",
            path: domainPath(domain, "/files", query: dir.isEmpty ? [] : [URLQueryItem(name: "dir", value: dir)])
        )
    }

    func readFile(_ domain: String, path filePath: String) async throws -> DomainFileContent {
        try await client.request(
            "GET",
            path: domainPath(domain, "/files/content", query: [URLQueryItem(name: "path", value: filePath)])
        )
    }

    func saveFile(_ domain: String, path filePath: String, content: String) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/files"),
            body: FileSaveBody(action: "save", path: filePath, content: content)
        )
    }

    func deleteFile(_ domain: String, path filePath: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/files"),
            body: FilePathBody(path: filePath)
        )
    }

    func listMailMessages(
        _ domain: String,
        user: String,
        folder: String = "INBOX"
    ) async throws -> [MailMessageSummary] {
        let res: MailMessagesResponse = try await client.request(
            "GET",
            path: domainPath(
                domain,
                "/mailboxes/messages",
                query: [
                    URLQueryItem(name: "user", value: user),
                    URLQueryItem(name: "folder", value: folder),
                ]
            )
        )
        return res.messages ?? []
    }

    func fetchMailMessage(
        _ domain: String,
        user: String,
        messageId: String,
        folder: String = "INBOX"
    ) async throws -> MailMessageDetail {
        let idSegment = messageId.urlPathSegmentEncoded
        let res: MailMessageDetailResponse = try await client.request(
            "GET",
            path: domainPath(
                domain,
                "/mailboxes/messages/\(idSegment)",
                query: [
                    URLQueryItem(name: "user", value: user),
                    URLQueryItem(name: "folder", value: folder),
                ]
            )
        )
        guard let message = res.message else {
            throw APIError.message("Message not found.")
        }
        return message
    }

    func sendMail(
        _ domain: String,
        user: String,
        to: String,
        subject: String,
        body: String,
        cc: String = "",
        inReplyTo: String = "",
        references: String = ""
    ) async throws {
        let _: SendMailResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/mailboxes/send"),
            body: SendMailBody(
                user: user,
                to: to,
                cc: cc,
                subject: subject,
                body: body,
                inReplyTo: inReplyTo,
                references: references
            )
        )
    }

    private func domainPath(_ domain: String, _ suffix: String = "", query: [URLQueryItem] = []) -> String {
        let domainEnc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var components = URLComponents()
        components.path = "/api/domains/\(domainEnc)\(suffix)"
        if !query.isEmpty {
            components.queryItems = query
        }
        let queryString = components.percentEncodedQuery.map { "?\($0)" } ?? ""
        return components.path + queryString
    }
}

private extension String {
    var urlPathSegmentEncoded: String {
        addingPercentEncoding(
            withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        ) ?? self
    }
}

private struct LoginBody: Encodable {
    let username: String
    let password: String
    let deviceLabel: String
}

private struct TotpBody: Encodable {
    let loginToken: String
    let totp: String
    let deviceLabel: String
}

private struct RefreshBody: Encodable {
    let refreshToken: String
}

private struct LogoutBody: Encodable {
    let refreshToken: String
}

private struct SslRenewBody: Encodable {
    let host: String
}

private struct PushRegisterBody: Encodable {
    let token: String
    let bundleId: String?
    let deviceLabel: String?
}

private struct PushUnregisterBody: Encodable {
    let token: String
}

private struct FilePathBody: Encodable {
    let path: String
}

private struct FileSaveBody: Encodable {
    let action: String
    let path: String
    let content: String
}

private struct SendMailBody: Encodable {
    let user: String
    let to: String
    let cc: String
    let subject: String
    let body: String
    let inReplyTo: String
    let references: String
}

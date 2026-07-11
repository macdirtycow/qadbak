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
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        return try await client.request("GET", path: "/api/domains/\(enc)")
    }

    func listDns(_ domain: String) async throws -> [DnsRecord] {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let res: DnsResponse = try await client.request("GET", path: "/api/domains/\(enc)/dns")
        return res.records ?? []
    }

    func addDns(_ domain: String, record: DnsRecord) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: OkResponse = try await client.request(
            "POST",
            path: "/api/domains/\(enc)/dns",
            body: record
        )
    }

    func deleteDns(_ domain: String, record: DnsRecord) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: OkResponse = try await client.request(
            "DELETE",
            path: "/api/domains/\(enc)/dns",
            body: record
        )
    }

    func listMailUsers(_ domain: String) async throws -> [MailUser] {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let res: MailUsersResponse = try await client.request("GET", path: "/api/domains/\(enc)/users")
        return res.users ?? []
    }

    func listSsl(_ domain: String) async throws -> [SslCert] {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let res: SslListResponse = try await client.request("GET", path: "/api/domains/\(enc)/ssl")
        return res.certs ?? []
    }

    func renewSsl(_ domain: String, host: String? = nil) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: OkResponse = try await client.request(
            "POST",
            path: "/api/domains/\(enc)/ssl",
            body: SslRenewBody(host: host ?? domain)
        )
    }

    func listBackups(_ domain: String) async throws -> BackupsResponse {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        return try await client.request("GET", path: "/api/domains/\(enc)/backups")
    }

    func startBackup(_ domain: String) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: OkResponse = try await client.request("POST", path: "/api/domains/\(enc)/backups")
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

    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=")
        let dirEnc = dir.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        let query = dirEnc.isEmpty ? "" : "?dir=\(dirEnc)"
        return try await client.request("GET", path: "/api/domains/\(enc)/files\(query)")
    }

    func readFile(_ domain: String, path filePath: String) async throws -> DomainFileContent {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=")
        let pathEnc = filePath.addingPercentEncoding(withAllowedCharacters: allowed) ?? filePath
        return try await client.request(
            "GET",
            path: "/api/domains/\(enc)/files/content?path=\(pathEnc)"
        )
    }

    func deleteFile(_ domain: String, path filePath: String) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: OkResponse = try await client.request(
            "DELETE",
            path: "/api/domains/\(enc)/files",
            body: FilePathBody(path: filePath)
        )
    }

    func listMailMessages(
        _ domain: String,
        user: String,
        folder: String = "INBOX"
    ) async throws -> [MailMessageSummary] {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=")
        let userEnc = user.addingPercentEncoding(withAllowedCharacters: allowed) ?? user
        let folderEnc = folder.addingPercentEncoding(withAllowedCharacters: allowed) ?? folder
        let res: MailMessagesResponse = try await client.request(
            "GET",
            path: "/api/domains/\(enc)/mailboxes/messages?user=\(userEnc)&folder=\(folderEnc)"
        )
        return res.messages ?? []
    }

    func fetchMailMessage(
        _ domain: String,
        user: String,
        messageId: String,
        folder: String = "INBOX"
    ) async throws -> MailMessageDetail {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=")
        let userEnc = user.addingPercentEncoding(withAllowedCharacters: allowed) ?? user
        let folderEnc = folder.addingPercentEncoding(withAllowedCharacters: allowed) ?? folder
        let idEnc = messageId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? messageId
        let res: MailMessageDetailResponse = try await client.request(
            "GET",
            path: "/api/domains/\(enc)/mailboxes/messages/\(idEnc)?user=\(userEnc)&folder=\(folderEnc)"
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
        cc: String = ""
    ) async throws {
        let enc = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let _: SendMailResponse = try await client.request(
            "POST",
            path: "/api/domains/\(enc)/mailboxes/send",
            body: SendMailBody(user: user, to: to, cc: cc, subject: subject, body: body)
        )
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

private struct FilePathBody: Encodable {
    let path: String
}

private struct SendMailBody: Encodable {
    let user: String
    let to: String
    let cc: String
    let subject: String
    let body: String
}

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

    func createDomain(_ request: CreateDomainRequest) async throws -> CreateDomainResponse {
        try await client.request("POST", path: "/api/domains", body: request)
    }

    func domainTerminalSession(_ domain: String) async throws -> TerminalSessionInfo {
        try await client.request("GET", path: domainPath(domain, "/terminal/ws-token"))
    }

    func adminTerminalSession() async throws -> TerminalSessionInfo {
        try await client.request("GET", path: "/api/admin/terminal/ws-token")
    }

    func qadbakUpdateStatus() async throws -> UpdatesStatusResponse {
        try await client.request("GET", path: "/api/admin/updates/qadbak")
    }

    func refreshQadbakUpdateStatus() async throws -> UpdatesStatusResponse {
        try await client.request("POST", path: "/api/admin/updates/qadbak", body: UpdateActionBody(action: "refresh"))
    }

    func upgradeQadbakPanel() async throws -> UpgradeStartResponse {
        try await client.request("POST", path: "/api/admin/updates/qadbak", body: UpdateActionBody(action: "upgrade"))
    }

    func pollUpdateJob(_ jobId: String) async throws -> UpdateJobResponse {
        try await client.request(
            "GET",
            path: adminPath("/api/admin/updates/qadbak", query: [URLQueryItem(name: "jobId", value: jobId)])
        )
    }

    func linuxUpdateStatus() async throws -> UpdatesStatusResponse {
        try await client.request("GET", path: "/api/admin/updates/linux")
    }

    func upgradeLinuxPackages() async throws -> UpgradeStartResponse {
        try await client.request("POST", path: "/api/admin/updates/linux", body: UpdateActionBody(action: "upgrade"))
    }

    func panelControlStatus() async throws -> PanelControlResponse {
        try await client.request("GET", path: "/api/admin/panel-control")
    }

    func panelControlAction(_ action: String) async throws -> PanelControlResponse {
        try await client.request("POST", path: "/api/admin/panel-control", body: PanelControlBody(action: action))
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

    func createMailUser(_ domain: String, user: String, pass: String, real: String?) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/users"),
            body: MailUserCreateBody(user: user, pass: pass, real: real)
        )
    }

    func updateMailUser(_ domain: String, user: String, pass: String?) async throws {
        let _: OkResponse = try await client.request(
            "PATCH",
            path: domainPath(domain, "/users"),
            body: MailUserUpdateBody(user: user, pass: pass)
        )
    }

    func deleteMailUser(_ domain: String, user: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/users"),
            body: MailUserDeleteBody(user: user)
        )
    }

    func listDatabases(_ domain: String) async throws -> [HostedDatabase] {
        let res: DatabasesResponse = try await client.request("GET", path: domainPath(domain, "/databases"))
        return res.databases ?? []
    }

    func createDatabase(_ domain: String, name: String, pass: String, type: String = "mysql") async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/databases"),
            body: DatabaseCreateBody(name: name, pass: pass, type: type)
        )
    }

    func listAliases(_ domain: String) async throws -> [MailAlias] {
        let res: AliasesResponse = try await client.request("GET", path: domainPath(domain, "/aliases"))
        return res.aliases ?? []
    }

    func createAlias(_ domain: String, from: String, to: String) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/aliases"),
            body: AliasBody(from: from, to: to)
        )
    }

    func deleteAlias(_ domain: String, from: String, to: String?) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/aliases"),
            body: AliasBody(from: from, to: to)
        )
    }

    func listRedirects(_ domain: String) async throws -> [DomainRedirect] {
        let res: RedirectsResponse = try await client.request("GET", path: domainPath(domain, "/redirects"))
        return res.redirects ?? []
    }

    func createRedirect(_ domain: String, path: String, dest: String, type: String = "301") async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/redirects"),
            body: RedirectBody(path: path, dest: dest, type: type)
        )
    }

    func deleteRedirect(_ domain: String, path: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/redirects"),
            body: RedirectDeleteBody(path: path)
        )
    }

    func enableDomain(_ domain: String) async throws {
        let _: OkResponse = try await client.request("POST", path: domainPath(domain, "/enable"))
    }

    func disableDomain(_ domain: String) async throws {
        let _: OkResponse = try await client.request("POST", path: domainPath(domain, "/disable"))
    }

    func adminHealth() async throws -> HealthReport {
        let res: AdminHealthResponse = try await client.request("GET", path: "/api/admin/health")
        guard let report = res.report else {
            throw APIError.message("Health report unavailable.")
        }
        return report
    }

    func listCronJobs(_ domain: String) async throws -> (jobs: [CronJob], canEdit: Bool) {
        let res: CronJobsResponse = try await client.request("GET", path: domainPath(domain, "/cron"))
        return (res.jobs ?? [], res.canEdit ?? false)
    }

    func createCronJob(_ domain: String, schedule: String, command: String, user: String?) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/cron"),
            body: CronJobCreateBody(schedule: schedule, command: command, user: user)
        )
    }

    func deleteCronJob(_ domain: String, id: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/cron"),
            body: CronJobDeleteBody(id: id)
        )
    }

    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount] {
        let res: FtpAccountsResponse = try await client.request("GET", path: domainPath(domain, "/ftp"))
        return res.accounts ?? []
    }

    func createFtpAccount(_ domain: String, user: String, pass: String) async throws {
        let _: OkResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/ftp"),
            body: FtpAccountBody(user: user, pass: pass)
        )
    }

    func updateFtpPassword(_ domain: String, user: String, pass: String) async throws {
        let _: OkResponse = try await client.request(
            "PATCH",
            path: domainPath(domain, "/ftp"),
            body: FtpAccountBody(user: user, pass: pass)
        )
    }

    func deleteFtpAccount(_ domain: String, user: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/ftp"),
            body: FtpAccountDeleteBody(user: user)
        )
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

    func startBackup(_ domain: String) async throws -> String? {
        let res: StartBackupResponse = try await client.request("POST", path: domainPath(domain, "/backups"))
        return res.result?.file
    }

    func makeBackupICloudService() -> BackupICloudService {
        BackupICloudService(
            baseURL: baseURL,
            tokenProvider: tokenProvider,
            refreshHandler: { [weak self] in
                guard let self else { throw APIError.unauthorized }
                try await self.performRefresh()
            }
        )
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

    func mkdir(_ domain: String, parent: String, name: String) async throws {
        let _: FilePathResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/files"),
            body: FileMkdirBody(action: "mkdir", parent: parent.isEmpty ? nil : parent, name: name)
        )
    }

    func createFile(_ domain: String, parent: String, name: String, content: String = "") async throws {
        let _: FilePathResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/files"),
            body: FileCreateBody(
                action: "create-file",
                parent: parent.isEmpty ? nil : parent,
                name: name,
                content: content
            )
        )
    }

    func moveFile(
        _ domain: String,
        path filePath: String,
        destDir: String? = nil,
        newName: String? = nil,
        overwrite: Bool = false
    ) async throws {
        let _: FilePathResponse = try await client.request(
            "POST",
            path: domainPath(domain, "/files"),
            body: FileMoveBody(
                action: "move",
                path: filePath,
                destDir: destDir,
                newName: newName,
                overwrite: overwrite
            )
        )
    }

    func uploadFiles(
        _ domain: String,
        dir: String,
        files: [(name: String, data: Data, mimeType: String)],
        overwrite: Bool = true
    ) async throws -> FileUploadResponse {
        let data = try await client.uploadMultipart(
            path: domainPath(domain, "/files/upload"),
            fields: [
                "dir": dir,
                "overwrite": overwrite ? "true" : "false",
            ],
            files: files.map { file in
                (fieldName: "files", fileName: file.name, mimeType: file.mimeType, data: file.data)
            }
        )
        return try JSONDecoder().decode(FileUploadResponse.self, from: data)
    }

    func listDomainScripts(_ domain: String) async throws -> DomainScriptsResponse {
        try await client.request("GET", path: domainPath(domain, "/scripts"))
    }

    func installDomainScript(
        _ domain: String,
        script: String,
        path: String = "public_html",
        forceOverwrite: Bool = false
    ) async throws -> ScriptInstallResponse {
        try await client.request(
            "POST",
            path: domainPath(domain, "/scripts"),
            body: ScriptInstallBody(script: script, path: path, forceOverwrite: forceOverwrite)
        )
    }

    func deleteDomainScript(_ domain: String, script: String) async throws {
        let _: OkResponse = try await client.request(
            "DELETE",
            path: domainPath(domain, "/scripts"),
            body: ScriptDeleteBody(script: script)
        )
    }

    func appCatalog() async throws -> AppCatalogResponse {
        try await client.request("GET", path: "/api/admin/apps/catalog")
    }

    func installApp(templateId: String, input: [String: String]) async throws -> AppInstallResponse {
        try await client.request(
            "POST",
            path: "/api/admin/apps/install",
            body: AppInstallBody(templateId: templateId, input: input)
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

    private func domainPath(
        _ domain: String,
        _ suffix: String = "",
        query: [URLQueryItem] = []
    ) -> String {
        adminPath("/api/domains/\(domainEncoded(domain))\(suffix)", query: query)
    }

    private func adminPath(_ path: String, query: [URLQueryItem] = []) -> String {
        var components = URLComponents()
        components.path = path
        if !query.isEmpty {
            components.queryItems = query
        }
        let queryString = components.percentEncodedQuery.map { "?\($0)" } ?? ""
        return components.path + queryString
    }

    private func domainEncoded(_ domain: String) -> String {
        domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
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

private struct FileMkdirBody: Encodable {
    let action: String
    let parent: String?
    let name: String
}

private struct FileCreateBody: Encodable {
    let action: String
    let parent: String?
    let name: String
    let content: String
}

private struct FileMoveBody: Encodable {
    let action: String
    let path: String
    let destDir: String?
    let newName: String?
    let overwrite: Bool
}

private struct ScriptInstallBody: Encodable {
    let script: String
    let path: String
    let forceOverwrite: Bool
}

private struct ScriptDeleteBody: Encodable {
    let script: String
}

private struct AppInstallBody: Encodable {
    let templateId: String
    let input: [String: String]
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

private struct UpdateActionBody: Encodable {
    let action: String
}

private struct PanelControlBody: Encodable {
    let action: String
}

private struct MailUserCreateBody: Encodable {
    let user: String
    let pass: String
    let real: String?
}

private struct MailUserUpdateBody: Encodable {
    let user: String
    let pass: String?
}

private struct MailUserDeleteBody: Encodable {
    let user: String
}

private struct DatabaseCreateBody: Encodable {
    let name: String
    let pass: String
    let type: String
}

private struct AliasBody: Encodable {
    let from: String
    let to: String?
}

private struct RedirectBody: Encodable {
    let path: String
    let dest: String
    let type: String
}

private struct RedirectDeleteBody: Encodable {
    let path: String
}

private struct CronJobCreateBody: Encodable {
    let schedule: String
    let command: String
    let user: String?
}

private struct CronJobDeleteBody: Encodable {
    let id: String
}

private struct FtpAccountBody: Encodable {
    let user: String
    let pass: String
}

private struct FtpAccountDeleteBody: Encodable {
    let user: String
}

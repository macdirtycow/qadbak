import Foundation

@MainActor
final class AgentPanelHostingAPI: DomainHostingAPI {
    private let client: AgentAPIClient

    init(client: AgentAPIClient) {
        self.client = client
    }

    func listDomains() async throws -> [HostedDomain] {
        let res: AgentPanelDomainsResponse = try await client.request("GET", path: "/api/v1/panels/domains")
        guard res.ok != false else {
            throw APIError.message("Could not load domains.")
        }
        return res.domains ?? []
    }

    func widgetSummary() async throws -> WidgetSummary {
        let res: AgentPanelWidgetSummaryResponse = try await client.request(
            "GET",
            path: "/api/v1/panels/widgets/summary"
        )
        if let summary = res.summary {
            return summary
        }
        let domains = try await listDomains()
        let running = domains.filter { $0.disabled != true }.count
        return WidgetSummary(
            domainCount: domains.count,
            websitesRunning: running,
            sslExpiringSoon: 0,
            backupStale: 0,
            containersStopped: 0,
            urgentActions: 0,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            domains: nil
        )
    }

    func createDomain(_ request: CreateDomainRequest) async throws -> CreateDomainResponse {
        let domain = request.domain.trimmingCharacters(in: .whitespacesAndNewlines)
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "panel.domain.create",
            target: "*"
        ) { token in
            let _: AgentActionResponse = try await client.createPanelDomain(
                domain: domain,
                user: request.user,
                confirmToken: token
            )
        }
        return CreateDomainResponse(
            ok: true,
            domain: domain,
            hostingNote: "Domain created via linked HestiaCP panel.",
            dnsNote: nil,
            premiumNote: nil,
            unixPassword: nil,
            clientUsername: nil,
            clientPassword: nil,
            panelUrl: nil,
            journalId: nil
        )
    }

    func domainDetail(_ domain: String) async throws -> DomainDetailResponse {
        let domains = try await listDomains()
        guard let match = domains.first(where: { $0.name.caseInsensitiveCompare(domain) == .orderedSame }) else {
            throw APIError.message("Domain not found.")
        }
        return DomainDetailResponse(domain: match, disabled: match.disabled)
    }

    func listDns(_ domain: String) async throws -> [DnsRecord] {
        let res: AgentPanelDnsResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/dns")
        )
        return res.records ?? []
    }

    func addDns(_ domain: String, record: DnsRecord) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/dns"),
            body: record
        )
    }

    func deleteDns(_ domain: String, record: DnsRecord) async throws {
        guard let recordId = record.recordId, !recordId.isEmpty else {
            throw APIError.message("This DNS record cannot be deleted (missing id).")
        }
        let encoded = recordId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? recordId
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: "\(panelDomainPath(domain, suffix: "/dns"))?id=\(encoded)"
        )
    }

    func listMailUsers(_ domain: String) async throws -> [MailUser] {
        let res: MailUsersResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/mail")
        )
        return res.users ?? []
    }

    func createMailUser(_ domain: String, user: String, pass: String, real: String?) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/mail"),
            body: AgentPanelMailBody(user: user, password: pass)
        )
        _ = real
    }

    func deleteMailUser(_ domain: String, user: String) async throws {
        let encoded = user.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? user
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: "\(panelDomainPath(domain, suffix: "/mail"))?user=\(encoded)"
        )
    }

    func updateMailUser(_ domain: String, user: String, pass: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "PATCH",
            path: panelDomainPath(domain, suffix: "/mail"),
            body: AgentPanelMailBody(user: user, password: pass)
        )
    }

    func listDatabases(_ domain: String) async throws -> [HostedDatabase] {
        let res: DatabasesResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/databases")
        )
        return res.databases ?? []
    }

    func createDatabase(_ domain: String, name: String, pass: String, type: String) async throws {
        let dbName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/databases"),
            body: AgentPanelDatabaseBody(name: dbName, user: dbName, password: pass)
        )
        _ = type
    }

    func updateDatabasePassword(_ domain: String, name: String, pass: String) async throws {
        let dbName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let _: AgentActionResponse = try await client.request(
            "PATCH",
            path: panelDomainPath(domain, suffix: "/databases"),
            body: AgentPanelDatabaseBody(name: dbName, user: dbName, password: pass)
        )
    }

    func listAliases(_ domain: String) async throws -> [MailAlias] {
        let res: AliasesResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/aliases")
        )
        return res.aliases ?? []
    }

    func createAlias(_ domain: String, from: String, to: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/aliases"),
            body: AgentPanelAliasBody(from: from, to: to)
        )
    }

    func deleteAlias(_ domain: String, from: String, to: String?) async throws {
        let encoded = from.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? from
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: "\(panelDomainPath(domain, suffix: "/aliases"))?from=\(encoded)"
        )
        _ = to
    }

    func listSsl(_ domain: String) async throws -> [SslCert] {
        let res: AgentPanelSslResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/ssl")
        )
        return res.certificates ?? []
    }

    func renewSsl(_ domain: String, host: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/ssl")
        )
        _ = host
    }

    func listRedirects(_ domain: String) async throws -> [DomainRedirect] {
        let res: RedirectsResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/redirects")
        )
        return res.redirects ?? []
    }

    func createRedirect(_ domain: String, path: String, dest: String, type: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/redirects"),
            body: AgentRedirectBody(path: path, dest: dest, type: type)
        )
    }

    func deleteRedirect(_ domain: String, path: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: panelDomainPath(domain, suffix: "/redirects"),
            body: AgentRedirectDeleteBody(path: path)
        )
    }

    func listCronJobs(_ domain: String) async throws -> (jobs: [CronJob], canEdit: Bool) {
        let res: CronJobsResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/cron")
        )
        return (res.jobs ?? [], res.canEdit ?? false)
    }

    func createCronJob(_ domain: String, schedule: String, command: String, user: String?) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/cron"),
            body: AgentCronJobCreateBody(schedule: schedule, command: command, user: user)
        )
    }

    func deleteCronJob(_ domain: String, id: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: panelDomainPath(domain, suffix: "/cron"),
            body: AgentCronJobDeleteBody(id: id)
        )
    }

    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount] {
        let res: FtpAccountsResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/ftp")
        )
        return res.accounts ?? []
    }

    func createFtpAccount(_ domain: String, user: String, pass: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/ftp"),
            body: AgentFtpAccountBody(user: user, pass: pass)
        )
    }

    func updateFtpPassword(_ domain: String, user: String, pass: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "PATCH",
            path: panelDomainPath(domain, suffix: "/ftp"),
            body: AgentFtpAccountBody(user: user, pass: pass)
        )
    }

    func deleteFtpAccount(_ domain: String, user: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: panelDomainPath(domain, suffix: "/ftp"),
            body: AgentFtpAccountDeleteBody(user: user)
        )
    }

    func listBackups(_ domain: String) async throws -> BackupsResponse {
        try await client.request("GET", path: panelDomainPath(domain, suffix: "/backups"))
    }

    func startBackup(_ domain: String) async throws -> String? {
        let res: StartBackupResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/backups")
        )
        return res.result?.file
    }

    func downloadBackup(_ domain: String, archiveName: String) async throws -> URL {
        let encodedDomain = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let encodedName = archiveName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? archiveName
        let path = "/api/v1/panels/domains/\(encodedDomain)/backups/download?name=\(encodedName)"
        return try await client.downloadFile(path: path, timeout: 7_200)
    }

    func deleteDomain(_ domain: String) async throws {
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "panel.domain.delete",
            target: domain
        ) { token in
            let _: AgentActionResponse = try await client.deletePanelDomain(domain: domain, confirmToken: token)
        }
    }

    func enableDomain(_ domain: String) async throws {
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "panel.domain.enable",
            target: domain
        ) { token in
            let _: AgentActionResponse = try await client.setPanelDomainEnabled(
                domain: domain,
                enabled: true,
                confirmToken: token
            )
        }
    }

    func disableDomain(_ domain: String) async throws {
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "panel.domain.disable",
            target: domain
        ) { token in
            let _: AgentActionResponse = try await client.setPanelDomainEnabled(
                domain: domain,
                enabled: false,
                confirmToken: token
            )
        }
    }

    func deleteDatabase(_ domain: String, name: String) async throws {
        let encodedName = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? name
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: "\(panelDomainPath(domain, suffix: "/databases"))?name=\(encodedName)"
        )
    }

    func websiteHealth(_ domain: String) async throws -> WebsiteHealthReport {
        let res: AgentPanelHealthResponse = try await client.request(
            "GET",
            path: panelDomainPath(domain, suffix: "/website-health")
        )
        guard let report = res.report else {
            throw APIError.message("Health report unavailable.")
        }
        return report
    }

    func websiteLogs(_ domain: String, type: String) async throws -> WebsiteLogsResponse {
        let encodedType = type.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? type
        return try await client.request(
            "GET",
            path: "\(panelDomainPath(domain, suffix: "/logs"))?type=\(encodedType)"
        )
    }

    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing {
        var path = panelDomainPath(domain, suffix: "/files")
        if !dir.isEmpty {
            let encoded = dir.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? dir
            path += "?dir=\(encoded)"
        }
        return try await client.request("GET", path: path)
    }

    func readFile(_ domain: String, path filePath: String) async throws -> DomainFileContent {
        let encoded = filePath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? filePath
        return try await client.request(
            "GET",
            path: "\(panelDomainPath(domain, suffix: "/files/content"))?path=\(encoded)"
        )
    }

    func saveFile(_ domain: String, path filePath: String, content: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/files"),
            body: AgentFileSaveBody(action: "save", path: filePath, content: content)
        )
    }

    func deleteFile(_ domain: String, path filePath: String) async throws {
        let _: AgentActionResponse = try await client.request(
            "DELETE",
            path: panelDomainPath(domain, suffix: "/files"),
            body: AgentFilePathBody(path: filePath)
        )
    }

    func mkdir(_ domain: String, parent: String, name: String) async throws {
        let _: AgentFilePathResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/files"),
            body: AgentFileMkdirBody(action: "mkdir", parent: parent.nilIfEmpty, name: name)
        )
    }

    func createFile(_ domain: String, parent: String, name: String, content: String) async throws {
        let _: AgentFilePathResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/files"),
            body: AgentFileCreateBody(
                action: "create-file",
                parent: parent.nilIfEmpty,
                name: name,
                content: content
            )
        )
    }

    func moveFile(
        _ domain: String,
        path filePath: String,
        destDir: String?,
        newName: String?,
        overwrite: Bool
    ) async throws {
        let _: AgentFilePathResponse = try await client.request(
            "POST",
            path: panelDomainPath(domain, suffix: "/files"),
            body: AgentFileMoveBody(
                action: "move",
                path: filePath,
                destDir: destDir?.nilIfEmpty,
                newName: newName?.nilIfEmpty,
                overwrite: overwrite
            )
        )
    }

    func uploadFiles(
        _ domain: String,
        dir: String,
        files: [(name: String, data: Data, mimeType: String)],
        overwrite: Bool
    ) async throws -> FileUploadResponse {
        let data = try await client.uploadMultipart(
            path: panelDomainPath(domain, suffix: "/files/upload"),
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

    private func panelDomainPath(_ domain: String, suffix: String) -> String {
        let encoded = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        return "/api/v1/panels/domains/\(encoded)\(suffix)"
    }
}

extension AgentAPIClient {
    func createPanelDomain(domain: String, user: String?, confirmToken: String) async throws -> AgentActionResponse {
        struct Body: Encodable {
            let domain: String
            let user: String?
        }
        return try await request(
            "POST",
            path: "/api/v1/panels/domains",
            body: Body(domain: domain, user: user?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty),
            confirmToken: confirmToken
        )
    }

    func deletePanelDomain(domain: String, confirmToken: String) async throws -> AgentActionResponse {
        let encoded = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        return try await request(
            "DELETE",
            path: "/api/v1/panels/domains/\(encoded)",
            confirmToken: confirmToken
        )
    }

    func setPanelDomainEnabled(domain: String, enabled: Bool, confirmToken: String) async throws -> AgentActionResponse {
        let encoded = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        let suffix = enabled ? "/enable" : "/disable"
        return try await request(
            "POST",
            path: "/api/v1/panels/domains/\(encoded)\(suffix)",
            confirmToken: confirmToken
        )
    }

    func listPanelApps() async throws -> [PanelApp] {
        let res: AgentPanelAppsResponse = try await request("GET", path: "/api/v1/panels/apps")
        guard res.ok != false else {
            throw APIError.message("Could not load apps.")
        }
        return res.apps ?? []
    }

    func panelAppAction(id: String, action: String, confirmToken: String) async throws -> AgentActionResponse {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return try await request(
            "POST",
            path: "/api/v1/panels/apps/\(encoded)/\(action)",
            confirmToken: confirmToken
        )
    }
}

private struct AgentPanelWidgetSummaryResponse: Decodable {
    let ok: Bool?
    let summary: WidgetSummary?
}

private struct AgentPanelHealthResponse: Decodable {
    let ok: Bool?
    let report: WebsiteHealthReport?
}

private struct AgentPanelDomainsResponse: Decodable {
    let ok: Bool?
    let domains: [HostedDomain]?
}

private struct AgentPanelDnsResponse: Decodable {
    let ok: Bool?
    let records: [DnsRecord]?
}

private struct AgentPanelSslResponse: Decodable {
    let ok: Bool?
    let certificates: [SslCert]?
}

private struct AgentPanelMailBody: Encodable {
    let user: String
    let password: String
}

private struct AgentPanelDatabaseBody: Encodable {
    let name: String
    let user: String
    let password: String
}

private struct AgentPanelAliasBody: Encodable {
    let from: String
    let to: String
}

private struct AgentRedirectBody: Encodable {
    let path: String
    let dest: String
    let type: String
}

private struct AgentRedirectDeleteBody: Encodable {
    let path: String
}

private struct AgentCronJobCreateBody: Encodable {
    let schedule: String
    let command: String
    let user: String?
}

private struct AgentCronJobDeleteBody: Encodable {
    let id: String
}

private struct AgentFtpAccountBody: Encodable {
    let user: String
    let pass: String
}

private struct AgentFtpAccountDeleteBody: Encodable {
    let user: String
}

struct PanelApp: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let status: String?
    let detail: String?
    let image: String?
    let project: String?
}

private struct AgentPanelAppsResponse: Decodable {
    let ok: Bool?
    let apps: [PanelApp]?
}

private struct AgentFilePathBody: Encodable {
    let path: String
}

private struct AgentFileSaveBody: Encodable {
    let action: String
    let path: String
    let content: String
}

private struct AgentFileMkdirBody: Encodable {
    let action: String
    let parent: String?
    let name: String
}

private struct AgentFileCreateBody: Encodable {
    let action: String
    let parent: String?
    let name: String
    let content: String
}

private struct AgentFileMoveBody: Encodable {
    let action: String
    let path: String
    let destDir: String?
    let newName: String?
    let overwrite: Bool
}

private struct AgentFilePathResponse: Decodable {
    let ok: Bool?
    let path: String?
}

private extension String {
    var nilIfEmpty: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}

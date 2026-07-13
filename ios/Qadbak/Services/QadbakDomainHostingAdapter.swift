import Foundation

@MainActor
final class QadbakDomainHostingAdapter: DomainHostingAPI {
    private let api: QadbakAPI

    init(api: QadbakAPI) {
        self.api = api
    }

    func listDomains() async throws -> [HostedDomain] { try await api.listDomains() }
    func widgetSummary() async throws -> WidgetSummary { try await api.widgetSummary() }
    func createDomain(_ request: CreateDomainRequest) async throws -> CreateDomainResponse {
        try await api.createDomain(request)
    }
    func domainDetail(_ domain: String) async throws -> DomainDetailResponse {
        try await api.domainDetail(domain)
    }
    func listDns(_ domain: String) async throws -> [DnsRecord] { try await api.listDns(domain) }
    func addDns(_ domain: String, record: DnsRecord) async throws { try await api.addDns(domain, record: record) }
    func deleteDns(_ domain: String, record: DnsRecord) async throws { try await api.deleteDns(domain, record: record) }
    func listMailUsers(_ domain: String) async throws -> [MailUser] { try await api.listMailUsers(domain) }
    func createMailUser(_ domain: String, user: String, pass: String, real: String?) async throws {
        try await api.createMailUser(domain, user: user, pass: pass, real: real)
    }
    func deleteMailUser(_ domain: String, user: String) async throws { try await api.deleteMailUser(domain, user: user) }
    func listDatabases(_ domain: String) async throws -> [HostedDatabase] { try await api.listDatabases(domain) }
    func createDatabase(_ domain: String, name: String, pass: String, type: String) async throws {
        try await api.createDatabase(domain, name: name, pass: pass, type: type)
    }
    func listAliases(_ domain: String) async throws -> [MailAlias] { try await api.listAliases(domain) }
    func createAlias(_ domain: String, from: String, to: String) async throws {
        try await api.createAlias(domain, from: from, to: to)
    }
    func deleteAlias(_ domain: String, from: String, to: String?) async throws {
        try await api.deleteAlias(domain, from: from, to: to)
    }
    func listSsl(_ domain: String) async throws -> [SslCert] { try await api.listSsl(domain) }
    func renewSsl(_ domain: String, host: String) async throws { try await api.renewSsl(domain, host: host) }
    func listRedirects(_ domain: String) async throws -> [DomainRedirect] { try await api.listRedirects(domain) }
    func createRedirect(_ domain: String, path: String, dest: String, type: String) async throws {
        try await api.createRedirect(domain, path: path, dest: dest, type: type)
    }
    func deleteRedirect(_ domain: String, path: String) async throws {
        try await api.deleteRedirect(domain, path: path)
    }
    func listCronJobs(_ domain: String) async throws -> (jobs: [CronJob], canEdit: Bool) {
        try await api.listCronJobs(domain)
    }
    func createCronJob(_ domain: String, schedule: String, command: String, user: String?) async throws {
        try await api.createCronJob(domain, schedule: schedule, command: command, user: user)
    }
    func deleteCronJob(_ domain: String, id: String) async throws {
        try await api.deleteCronJob(domain, id: id)
    }
    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount] { try await api.listFtpAccounts(domain) }
    func createFtpAccount(_ domain: String, user: String, pass: String) async throws {
        try await api.createFtpAccount(domain, user: user, pass: pass)
    }
    func updateFtpPassword(_ domain: String, user: String, pass: String) async throws {
        try await api.updateFtpPassword(domain, user: user, pass: pass)
    }
    func deleteFtpAccount(_ domain: String, user: String) async throws {
        try await api.deleteFtpAccount(domain, user: user)
    }
    func listBackups(_ domain: String) async throws -> BackupsResponse { try await api.listBackups(domain) }
    func startBackup(_ domain: String) async throws -> String? { try await api.startBackup(domain) }
    func deleteDomain(_ domain: String) async throws {
        throw DomainHostingError.notSupported("Delete domain")
    }
    func enableDomain(_ domain: String) async throws { try await api.enableDomain(domain) }
    func disableDomain(_ domain: String) async throws { try await api.disableDomain(domain) }
    func deleteDatabase(_ domain: String, name: String) async throws {
        throw DomainHostingError.notSupported("Delete database")
    }
    func websiteHealth(_ domain: String) async throws -> WebsiteHealthReport {
        try await api.websiteHealth(domain)
    }
    func websiteLogs(_ domain: String, type: String) async throws -> WebsiteLogsResponse {
        try await api.websiteLogs(domain, type: type)
    }
    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing {
        try await api.listFiles(domain, dir: dir)
    }
    func readFile(_ domain: String, path: String) async throws -> DomainFileContent {
        try await api.readFile(domain, path: path)
    }
    func saveFile(_ domain: String, path: String, content: String) async throws {
        try await api.saveFile(domain, path: path, content: content)
    }
    func deleteFile(_ domain: String, path: String) async throws {
        try await api.deleteFile(domain, path: path)
    }
    func mkdir(_ domain: String, parent: String, name: String) async throws {
        try await api.mkdir(domain, parent: parent, name: name)
    }
    func createFile(_ domain: String, parent: String, name: String, content: String) async throws {
        try await api.createFile(domain, parent: parent, name: name, content: content)
    }
    func moveFile(_ domain: String, path: String, destDir: String?, newName: String?, overwrite: Bool) async throws {
        try await api.moveFile(domain, path: path, destDir: destDir, newName: newName, overwrite: overwrite)
    }
    func uploadFiles(
        _ domain: String,
        dir: String,
        files: [(name: String, data: Data, mimeType: String)],
        overwrite: Bool
    ) async throws -> FileUploadResponse {
        try await api.uploadFiles(domain, dir: dir, files: files, overwrite: overwrite)
    }
}

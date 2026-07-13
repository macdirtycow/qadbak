import Foundation

/// Domain hosting operations shared by the Qadbak panel and linked external panels (HestiaCP via agent).
@MainActor
protocol DomainHostingAPI: AnyObject {
    func listDomains() async throws -> [HostedDomain]
    func widgetSummary() async throws -> WidgetSummary
    func createDomain(_ request: CreateDomainRequest) async throws -> CreateDomainResponse
    func domainDetail(_ domain: String) async throws -> DomainDetailResponse
    func listDns(_ domain: String) async throws -> [DnsRecord]
    func addDns(_ domain: String, record: DnsRecord) async throws
    func deleteDns(_ domain: String, record: DnsRecord) async throws
    func listMailUsers(_ domain: String) async throws -> [MailUser]
    func createMailUser(_ domain: String, user: String, pass: String, real: String?) async throws
    func deleteMailUser(_ domain: String, user: String) async throws
    func listDatabases(_ domain: String) async throws -> [HostedDatabase]
    func createDatabase(_ domain: String, name: String, pass: String, type: String) async throws
    func listAliases(_ domain: String) async throws -> [MailAlias]
    func createAlias(_ domain: String, from: String, to: String) async throws
    func deleteAlias(_ domain: String, from: String, to: String?) async throws
    func listSsl(_ domain: String) async throws -> [SslCert]
    func renewSsl(_ domain: String, host: String) async throws
    func listRedirects(_ domain: String) async throws -> [DomainRedirect]
    func createRedirect(_ domain: String, path: String, dest: String, type: String) async throws
    func deleteRedirect(_ domain: String, path: String) async throws
    func listCronJobs(_ domain: String) async throws -> (jobs: [CronJob], canEdit: Bool)
    func createCronJob(_ domain: String, schedule: String, command: String, user: String?) async throws
    func deleteCronJob(_ domain: String, id: String) async throws
    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount]
    func createFtpAccount(_ domain: String, user: String, pass: String) async throws
    func updateFtpPassword(_ domain: String, user: String, pass: String) async throws
    func deleteFtpAccount(_ domain: String, user: String) async throws
    func listBackups(_ domain: String) async throws -> BackupsResponse
    func startBackup(_ domain: String) async throws -> String?
    func deleteDomain(_ domain: String) async throws
    func enableDomain(_ domain: String) async throws
    func disableDomain(_ domain: String) async throws
    func deleteDatabase(_ domain: String, name: String) async throws
    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing
    func readFile(_ domain: String, path: String) async throws -> DomainFileContent
    func saveFile(_ domain: String, path: String, content: String) async throws
    func deleteFile(_ domain: String, path: String) async throws
    func mkdir(_ domain: String, parent: String, name: String) async throws
    func createFile(_ domain: String, parent: String, name: String, content: String) async throws
    func moveFile(_ domain: String, path: String, destDir: String?, newName: String?, overwrite: Bool) async throws
    func uploadFiles(_ domain: String, dir: String, files: [(name: String, data: Data, mimeType: String)], overwrite: Bool) async throws -> FileUploadResponse
    func websiteHealth(_ domain: String) async throws -> WebsiteHealthReport
    func websiteLogs(_ domain: String, type: String) async throws -> WebsiteLogsResponse
}

enum DomainHostingError: LocalizedError {
    case notSupported(String)

    var errorDescription: String? {
        switch self {
        case .notSupported(let feature):
            return "\(feature) is not available on this linked panel."
        }
    }
}

extension DomainHostingAPI {
    func createDomain(_ request: CreateDomainRequest) async throws -> CreateDomainResponse {
        throw DomainHostingError.notSupported("Add domain")
    }
    func listRedirects(_ domain: String) async throws -> [DomainRedirect] {
        throw DomainHostingError.notSupported("Redirects")
    }
    func createRedirect(_ domain: String, path: String, dest: String, type: String) async throws {
        throw DomainHostingError.notSupported("Redirects")
    }
    func deleteRedirect(_ domain: String, path: String) async throws {
        throw DomainHostingError.notSupported("Redirects")
    }
    func listCronJobs(_ domain: String) async throws -> (jobs: [CronJob], canEdit: Bool) {
        throw DomainHostingError.notSupported("Cron")
    }
    func createCronJob(_ domain: String, schedule: String, command: String, user: String?) async throws {
        throw DomainHostingError.notSupported("Cron")
    }
    func deleteCronJob(_ domain: String, id: String) async throws {
        throw DomainHostingError.notSupported("Cron")
    }
    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount] {
        throw DomainHostingError.notSupported("FTP")
    }
    func createFtpAccount(_ domain: String, user: String, pass: String) async throws {
        throw DomainHostingError.notSupported("FTP")
    }
    func updateFtpPassword(_ domain: String, user: String, pass: String) async throws {
        throw DomainHostingError.notSupported("FTP")
    }
    func deleteFtpAccount(_ domain: String, user: String) async throws {
        throw DomainHostingError.notSupported("FTP")
    }
    func listBackups(_ domain: String) async throws -> BackupsResponse {
        throw DomainHostingError.notSupported("Backups")
    }
    func startBackup(_ domain: String) async throws -> String? {
        throw DomainHostingError.notSupported("Backups")
    }
    func deleteDomain(_ domain: String) async throws {
        throw DomainHostingError.notSupported("Delete domain")
    }
    func enableDomain(_ domain: String) async throws {
        throw DomainHostingError.notSupported("Enable domain")
    }
    func disableDomain(_ domain: String) async throws {
        throw DomainHostingError.notSupported("Disable domain")
    }
    func deleteDatabase(_ domain: String, name: String) async throws {
        throw DomainHostingError.notSupported("Delete database")
    }
    func websiteHealth(_ domain: String) async throws -> WebsiteHealthReport {
        throw DomainHostingError.notSupported("Website health")
    }
    func websiteLogs(_ domain: String, type: String) async throws -> WebsiteLogsResponse {
        throw DomainHostingError.notSupported("Website logs")
    }
    func listFiles(_ domain: String, dir: String) async throws -> DomainFilesListing {
        throw DomainHostingError.notSupported("Files")
    }
    func readFile(_ domain: String, path: String) async throws -> DomainFileContent {
        throw DomainHostingError.notSupported("Files")
    }
    func saveFile(_ domain: String, path: String, content: String) async throws {
        throw DomainHostingError.notSupported("Files")
    }
    func deleteFile(_ domain: String, path: String) async throws {
        throw DomainHostingError.notSupported("Files")
    }
    func mkdir(_ domain: String, parent: String, name: String) async throws {
        throw DomainHostingError.notSupported("Files")
    }
    func createFile(_ domain: String, parent: String, name: String, content: String) async throws {
        throw DomainHostingError.notSupported("Files")
    }
    func moveFile(_ domain: String, path: String, destDir: String?, newName: String?, overwrite: Bool) async throws {
        throw DomainHostingError.notSupported("Files")
    }
    func uploadFiles(_ domain: String, dir: String, files: [(name: String, data: Data, mimeType: String)], overwrite: Bool) async throws -> FileUploadResponse {
        throw DomainHostingError.notSupported("Files")
    }
}

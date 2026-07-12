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
    func listFtpAccounts(_ domain: String) async throws -> [FtpAccount] {
        throw DomainHostingError.notSupported("FTP")
    }
}

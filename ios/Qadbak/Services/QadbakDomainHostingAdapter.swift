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
}

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

private extension String {
    var nilIfEmpty: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}

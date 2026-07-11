import Foundation

struct APIErrorResponse: Decodable {
    let error: String?
}

enum APIError: LocalizedError {
    case message(String)
    case totpRequired(loginToken: String)
    case unauthorized
    case http(Int, String?)

    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        case .totpRequired: return "Two-factor authentication required."
        case .unauthorized: return "Session expired. Sign in again."
        case .http(let code, let text): return text ?? "Request failed (\(code))."
        }
    }
}

struct LoginResponse: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let tokenType: String?
    let username: String?
    let role: String?
    let domains: [String]?
    let requiresTotp: Bool?
    let loginToken: String?
}

struct SessionInfo: Decodable {
    let username: String
    let role: String
    let domains: [String]
    let accessTokenTtlSec: Int?
    let clientRbac: Bool?
    let premiumWebmail: Bool?
    let capabilities: MobileCapabilities?
}

struct MobileCapabilities: Decodable {
    let push: Bool?
    let widgets: Bool?
    let files: Bool?
    let webmail: Bool?
    let clientOwnDomainsOnly: Bool?
}

struct WidgetSummary: Decodable {
    let domainCount: Int
    let sslExpiringSoon: Int
    let backupStale: Int
    let urgentActions: Int
    let updatedAt: String?
    let domains: [WidgetDomainSummary]?
}

struct WidgetDomainSummary: Decodable, Identifiable {
    var id: String { domain }
    let domain: String
    let sslDaysLeft: Int?
    let backupAgeDays: Int?
    let websiteOk: Bool?
    let dnsPending: Bool?
    let disabled: Bool?
}

struct DomainFilesListing: Decodable {
    let mode: String?
    let home: String?
    let cwd: String?
    let breadcrumbs: [FileBreadcrumb]?
    let entries: [DomainFileEntry]?
    let writable: Bool?
}

struct FileBreadcrumb: Decodable, Hashable {
    let label: String
    let path: String
}

struct DomainFileEntry: Decodable, Identifiable, Hashable {
    var id: String { path }
    let name: String
    let path: String
    let type: String
    let size: String?
    let modified: String?
    let editable: Bool?
    let deletable: Bool?
    let downloadable: Bool?

    var isDirectory: Bool { type == "dir" }
}

struct DomainFileContent: Decodable {
    let content: String
    let mime: String?
    let language: String?
    let readOnly: Bool?
    let encoding: String?
}

struct MailMessagesResponse: Decodable {
    let messages: [MailMessageSummary]?
    let folder: String?
    let count: Int?
}

struct MailMessageSummary: Decodable, Identifiable, Hashable {
    let id: String
    let subject: String?
    let from: String?
    let to: String?
    let date: String?

    enum CodingKeys: String, CodingKey {
        case id, subject, from, to, date
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) {
            id = s
        } else if let n = try? c.decode(Int.self, forKey: .id) {
            id = String(n)
        } else {
            id = UUID().uuidString
        }
        subject = try? c.decode(String.self, forKey: .subject)
        from = try? c.decode(String.self, forKey: .from)
        to = try? c.decode(String.self, forKey: .to)
        date = try? c.decode(String.self, forKey: .date)
    }
}

struct MailMessageDetailResponse: Decodable {
    let message: MailMessageDetail?
    let folder: String?
}

struct MailMessageDetail: Decodable {
    let id: String?
    let subject: String?
    let from: String?
    let to: String?
    let cc: String?
    let date: String?
    let bodyText: String?
}

struct SendMailResponse: Decodable {
    let ok: Bool?
}


struct HostedDomain: Decodable, Identifiable, Hashable {
    var id: String { name }
    let name: String
    let disabled: Bool?
    let plan: String?
    let user: String?
    let diskUsed: String?
    let diskLimit: String?

    enum CodingKeys: String, CodingKey {
        case name
        case disabled
        case plan
        case user
        case diskUsed = "disk_used"
        case diskLimit = "disk_limit"
        case valuesPlan = "values.plan"
        case valuesUser = "values.user"
        case valuesDiskUsed = "values.disk_used"
        case valuesDiskLimit = "values.disk_limit"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        if let d = try? c.decode(Bool.self, forKey: .disabled) {
            disabled = d
        } else if let s = try? c.decode(String.self, forKey: .disabled) {
            disabled = s == "1" || s.lowercased() == "true"
        } else {
            disabled = nil
        }
        plan = (try? c.decode(String.self, forKey: .plan))
            ?? (try? c.decode(String.self, forKey: .valuesPlan))
        user = (try? c.decode(String.self, forKey: .user))
            ?? (try? c.decode(String.self, forKey: .valuesUser))
        diskUsed = (try? c.decode(String.self, forKey: .diskUsed))
            ?? (try? c.decode(String.self, forKey: .valuesDiskUsed))
        diskLimit = (try? c.decode(String.self, forKey: .diskLimit))
            ?? (try? c.decode(String.self, forKey: .valuesDiskLimit))
    }
}

struct DomainsListResponse: Decodable {
    let domains: [HostedDomain]
}

struct DomainDetailResponse: Decodable {
    let domain: HostedDomain
    let disabled: Bool?
}

struct DnsRecord: Codable, Identifiable, Hashable {
    var id: String { "\(name)|\(type)|\(value)" }
    let name: String
    let type: String
    let value: String
    let ttl: String?
    let priority: String?
}

struct DnsResponse: Decodable {
    let records: [DnsRecord]?
}

struct MailUser: Decodable, Identifiable, Hashable {
    var id: String { email ?? user ?? UUID().uuidString }
    let user: String?
    let email: String?
    let real: String?
    let quota: String?

    enum CodingKeys: String, CodingKey {
        case user
        case email
        case real
        case quota
        case valuesUser = "values.user"
        case valuesReal = "values.real"
        case valuesQuota = "values.quota"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user = (try? c.decode(String.self, forKey: .user))
            ?? (try? c.decode(String.self, forKey: .valuesUser))
        email = try? c.decode(String.self, forKey: .email)
        real = (try? c.decode(String.self, forKey: .real))
            ?? (try? c.decode(String.self, forKey: .valuesReal))
        quota = (try? c.decode(String.self, forKey: .quota))
            ?? (try? c.decode(String.self, forKey: .valuesQuota))
    }

    var displayName: String {
        if let real, !real.isEmpty { return real }
        if let user, !user.isEmpty { return user }
        return email ?? "—"
    }

    var address: String {
        if let email, !email.isEmpty { return email }
        return user ?? "—"
    }
}

struct MailUsersResponse: Decodable {
    let users: [MailUser]?
}

struct SslCert: Decodable, Identifiable, Hashable {
    var id: String { host ?? issuer ?? UUID().uuidString }
    let host: String?
    let issuer: String?
    let expiry: String?
    let type: String?
}

struct SslListResponse: Decodable {
    let certs: [SslCert]?
}

struct ScheduledBackup: Decodable, Identifiable, Hashable {
    let id: String
    let schedule: String?
    let dest: String?
    let enabled: String?

    var isEnabled: Bool {
        guard let enabled else { return true }
        return enabled == "1" || enabled.lowercased() == "true" || enabled.lowercased() == "yes"
    }
}

struct BackupsResponse: Decodable {
    let scheduled: [ScheduledBackup]?
    let canBackup: Bool?
    let native: Bool?
}

struct OkResponse: Decodable {
    let ok: Bool?
}

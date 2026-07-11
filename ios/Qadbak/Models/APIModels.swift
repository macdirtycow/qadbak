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
        case .http(let code, let text):
            if let text, !text.isEmpty { return text }
            switch code {
            case 402: return "Requires Qadbak Premium on your server."
            case 403: return "You don't have permission for this action."
            case 404: return "Not found on the server."
            case 429: return "Too many requests. Wait a moment and try again."
            case 501: return "Not enabled on this server (check panel configuration)."
            case 503: return "Service temporarily unavailable."
            default: return "Request failed (\(code))."
            }
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
    let error: String?

    /// True when the server wants a TOTP code before issuing tokens.
    var totpChallengeToken: String? {
        let token = loginToken?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !token.isEmpty, accessToken == nil else { return nil }
        if requiresTotp == true { return token }
        if refreshToken == nil { return token }
        return nil
    }

    var serverError: String? {
        error?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    enum CodingKeys: String, CodingKey {
        case accessToken
        case refreshToken
        case expiresIn
        case tokenType
        case username
        case role
        case domains
        case requiresTotp
        case requires_totp
        case loginToken
        case login_token
        case error
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try? c.decode(String.self, forKey: .accessToken)
        refreshToken = try? c.decode(String.self, forKey: .refreshToken)
        expiresIn = try? c.decode(Int.self, forKey: .expiresIn)
        tokenType = try? c.decode(String.self, forKey: .tokenType)
        username = try? c.decode(String.self, forKey: .username)
        role = try? c.decode(String.self, forKey: .role)
        domains = try? c.decode([String].self, forKey: .domains)
        loginToken = (try? c.decode(String.self, forKey: .loginToken))
            ?? (try? c.decode(String.self, forKey: .login_token))
        error = try? c.decode(String.self, forKey: .error)
        if let flag = try? c.decode(Bool.self, forKey: .requiresTotp) {
            requiresTotp = flag
        } else if let flag = try? c.decode(Bool.self, forKey: .requires_totp) {
            requiresTotp = flag
        } else if (try? c.decode(Int.self, forKey: .requiresTotp)) == 1 {
            requiresTotp = true
        } else {
            requiresTotp = nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

struct SessionInfo: Decodable {
    let username: String
    let role: String
    let domains: [String]
    let accessTokenTtlSec: Int?
    let clientRbac: Bool?
    let premiumWebmail: Bool?
    let license: MobileLicenseInfo?
    let capabilities: MobileCapabilities?
}

struct MobileLicenseInfo: Decodable {
    let premiumActive: Bool?
    let plan: String?
    let label: String?
    let status: String?
    let features: [String]?

    var displayPlan: String? {
        if premiumActive == true {
            if let label, !label.isEmpty { return label }
            if let plan, !plan.isEmpty { return formatPlan(plan) }
            return "Premium"
        }
        if let plan, !plan.isEmpty, plan != "Core evaluation" {
            return formatPlan(plan)
        }
        return "Core (evaluation)"
    }

    private func formatPlan(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return raw }
        if trimmed.lowercased() == "core evaluation" { return "Core (evaluation)" }
        return trimmed.prefix(1).uppercased() + trimmed.dropFirst()
    }
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
    let websitesRunning: Int?
    let sslExpiringSoon: Int
    let backupStale: Int
    let containersStopped: Int?
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
    let containersStopped: [String]?
}

struct WebsiteLogsResponse: Decodable {
    let log: String?
    let type: String?
}

struct RepairWebsiteResponse: Decodable {
    let ok: Bool?
    let output: String?
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

    init(content: String, mime: String?, language: String?, readOnly: Bool?, encoding: String?) {
        self.content = content
        self.mime = mime
        self.language = language
        self.readOnly = readOnly
        self.encoding = encoding
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        content = try c.decode(String.self, forKey: .content)
        mime = try? c.decode(String.self, forKey: .mime)
        language = try? c.decode(String.self, forKey: .language)
        readOnly = try? c.decode(Bool.self, forKey: .readOnly)
        encoding = try? c.decode(String.self, forKey: .encoding)
    }

    private enum CodingKeys: String, CodingKey {
        case content, mime, language, readOnly, encoding
    }
}

struct MailMessagesResponse: Decodable {
    let messages: [MailMessageSummary]?
    let folder: String?
    let count: Int?
}

struct ImapMailbox: Decodable, Identifiable, Hashable {
    let name: String?
    let path: String?
    let folder: String?
    let messages: Int?
    let unseen: Int?
    let size: String?

    var id: String { folder ?? name ?? path ?? UUID().uuidString }

    var displayName: String {
        let raw = folder ?? name ?? path ?? "Mailbox"
        if raw == "INBOX" { return "Inbox" }
        return raw
    }

    var folderQueryValue: String {
        folder ?? name ?? path ?? "INBOX"
    }

    enum CodingKeys: String, CodingKey {
        case name, path, folder, messages, unseen, size, user
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try? c.decode(String.self, forKey: .name)
        path = try? c.decode(String.self, forKey: .path)
        folder = try? c.decode(String.self, forKey: .folder)
        if let n = try? c.decode(Int.self, forKey: .messages) {
            messages = n
        } else if let s = try? c.decode(String.self, forKey: .messages), let n = Int(s) {
            messages = n
        } else {
            messages = nil
        }
        unseen = try? c.decode(Int.self, forKey: .unseen)
        size = try? c.decode(String.self, forKey: .size)
    }
}

struct MailFoldersResponse: Decodable {
    let mailboxes: [ImapMailbox]?
    let source: String?
    let hint: String?
}

struct WebsiteHealthReport: Decodable {
    let domain: String?
    let originIp: String?
    let repairAvailable: Bool?
    let validation: WebsiteValidation?
    let localProbe: WebsiteProbe?
    let publicProbe: WebsiteProbe?
    let cloudflare: WebsiteCloudflareHints?
    let stack: WebsiteStackHealth?
}

struct WebsiteValidation: Decodable {
    let valid: Bool?
    let messages: [String]?
}

struct WebsiteProbe: Decodable {
    let ok: Bool?
    let status: Int?
    let error: String?
    let dnsPending: Bool?
    let cloudflare502: Bool?
    let cloudflare523: Bool?
}

struct WebsiteCloudflareHints: Decodable {
    let issues: [String]?
    let dnsChecklist: [String]?
}

struct WebsiteStackHealth: Decodable {
    let sslDaysLeft: Int?
    let backupAgeDays: Int?
}

struct MailMessageSummary: Decodable, Identifiable, Hashable {
    let id: String
    let subject: String?
    let from: String?
    let to: String?
    let date: String?
    let preview: String?
    let size: String?

    enum CodingKeys: String, CodingKey {
        case id, subject, from, to, date, preview, size, bodyText
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
        size = try? c.decode(String.self, forKey: .size)
        let explicitPreview = try? c.decode(String.self, forKey: .preview)
        let bodyPreview = try? c.decode(String.self, forKey: .bodyText)
        preview = explicitPreview ?? bodyPreview
    }
}

struct MailMessageDetailResponse: Decodable {
    let message: MailMessageDetail?
    let folder: String?
}

struct MailMessageDetail: Decodable {
    let id: String
    let subject: String?
    let from: String?
    let to: String?
    let cc: String?
    let date: String?
    let bodyText: String?
    let messageId: String?
    let replyTo: String?
    let references: String?
    let rawHeaders: String?
    let size: String?

    enum CodingKeys: String, CodingKey {
        case id, subject, from, to, cc, date, bodyText, messageId, replyTo, references, rawHeaders, size
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) {
            id = s
        } else if let n = try? c.decode(Int.self, forKey: .id) {
            id = String(n)
        } else {
            id = ""
        }
        subject = try? c.decode(String.self, forKey: .subject)
        from = try? c.decode(String.self, forKey: .from)
        to = try? c.decode(String.self, forKey: .to)
        cc = try? c.decode(String.self, forKey: .cc)
        date = try? c.decode(String.self, forKey: .date)
        bodyText = try? c.decode(String.self, forKey: .bodyText)
        messageId = try? c.decode(String.self, forKey: .messageId)
        replyTo = try? c.decode(String.self, forKey: .replyTo)
        references = try? c.decode(String.self, forKey: .references)
        rawHeaders = try? c.decode(String.self, forKey: .rawHeaders)
        size = try? c.decode(String.self, forKey: .size)
    }
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

import Foundation
import Observation

@MainActor
@Observable
final class QmailViewModel {
    let domainName: String
    let mailboxUser: String

    var folders: [ImapMailbox] = []
    var selectedFolder = "INBOX"
    var messages: [MailMessageSummary] = []
    var searchQuery = ""
    var isLoading = false
    var premiumBlocked = false
    var imapUnavailable = false
    var errorMessage: String?
    var lastSyncedAt: Date?

    init(domainName: String, mailboxUser: String) {
        self.domainName = domainName
        self.mailboxUser = Self.normalizeMailboxUser(mailboxUser, domain: domainName)
    }

    var accountEmail: String {
        mailboxUser.contains("@") ? mailboxUser : "\(mailboxUser)@\(domainName)"
    }

    var folderLabel: String {
        folders.first(where: { $0.folderQueryValue == selectedFolder })?.displayName ?? selectedFolder
    }

    var selectedFolderMeta: ImapMailbox? {
        folders.first(where: { $0.folderQueryValue == selectedFolder })
    }

    var totalCount: Int {
        selectedFolderMeta?.messages ?? messages.count
    }

    var unreadCount: Int {
        selectedFolderMeta?.unseen ?? 0
    }

    var filteredMessages: [MailMessageSummary] {
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return messages }
        return messages.filter {
            ($0.subject ?? "").lowercased().contains(q) ||
            ($0.from ?? "").lowercased().contains(q) ||
            ($0.preview ?? "").lowercased().contains(q)
        }
    }

    var statusLine: String {
        if let lastSyncedAt {
            let out = RelativeDateTimeFormatter()
            out.unitsStyle = .abbreviated
            return "Synced \(out.localizedString(for: lastSyncedAt, relativeTo: Date()))"
        }
        return "Pull down to refresh"
    }

    func reload(using api: QadbakAPI) async {
        isLoading = true
        errorMessage = nil
        premiumBlocked = false
        imapUnavailable = false
        defer { isLoading = false }
        do {
            let loadedFolders = try await api.listMailFolders(domainName, user: mailboxUser)
            folders = loadedFolders
            if !folders.contains(where: { $0.folderQueryValue == selectedFolder }) {
                selectedFolder = folders.first?.folderQueryValue ?? "INBOX"
            }
            try await loadMessages(using: api)
        } catch let err as APIError {
            applyAPIError(err)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadMessages(using api: QadbakAPI) async throws {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            messages = try await api.listMailMessages(domainName, user: mailboxUser, folder: selectedFolder)
            lastSyncedAt = Date()
            premiumBlocked = false
            imapUnavailable = false
        } catch let err as APIError {
            applyAPIError(err)
            throw err
        }
    }

    func selectFolder(_ folder: String, api: QadbakAPI) async {
        selectedFolder = folder
        do {
            try await loadMessages(using: api)
        } catch {
            // errorMessage set in loadMessages
        }
    }

    private func applyAPIError(_ err: APIError) {
        switch err {
        case .http(402, let message):
            premiumBlocked = true
            errorMessage = message ?? "Qmail requires Qadbak Premium (webmail-ui)."
        case .http(501, let message):
            imapUnavailable = true
            errorMessage = message ?? "IMAP is not enabled on this panel server."
        default:
            errorMessage = err.localizedDescription
        }
    }

    static func normalizeMailboxUser(_ raw: String, domain: String) -> String {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let at = value.firstIndex(of: "@") {
            value = String(value[..<at])
        }
        return value.isEmpty ? raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() : value
    }
}

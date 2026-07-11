import SwiftUI

struct MailAccountsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    var openWebmail: Bool = false

    @State private var users: [MailUser] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && users.isEmpty {
                ProgressView("Loading mail accounts…")
            } else if let errorMessage, users.isEmpty {
                ContentUnavailableView(
                    "Could not load mail",
                    systemImage: "envelope.badge",
                    description: Text(errorMessage)
                )
            } else if users.isEmpty {
                ContentUnavailableView(
                    "No mail accounts",
                    systemImage: "envelope",
                    description: Text("Create mailboxes in the web panel.")
                )
            } else {
                List(users) { user in
                    let mailbox = user.user ?? user.email?.components(separatedBy: "@").first ?? ""
                    if openWebmail, !mailbox.isEmpty, appState.webmailEnabled {
                        NavigationLink {
                            WebmailView(domainName: domainName, mailboxUser: mailbox)
                        } label: {
                            mailRow(user)
                        }
                    } else {
                        mailRow(user)
                    }
                }
            }
        }
        .navigationTitle(openWebmail ? "Webmail accounts" : "Mail")
        .refreshable { await load() }
        .task { await load() }
    }

    @ViewBuilder
    private func mailRow(_ user: MailUser) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(user.displayName)
                .font(.headline)
            Text(user.address.contains("@") ? user.address : "\(user.address)@\(domainName)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let quota = user.quota, !quota.isEmpty {
                Text("Quota: \(quota)")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            users = try await api.listMailUsers(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

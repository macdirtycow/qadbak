import SwiftUI

struct MailAccountsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    var openWebmail: Bool = false

    @State private var users: [MailUser] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            Group {
                if isLoading && users.isEmpty {
                    QBLoadingState(message: "Loading mail accounts…")
                } else if let errorMessage, users.isEmpty {
                    VStack(spacing: 12) {
                        ErrorBanner(message: errorMessage)
                        QBEmptyState(title: "Unavailable", message: "Could not load mail accounts.", icon: "envelope.badge")
                    }
                    .padding(20)
                } else if users.isEmpty {
                    QBEmptyState(
                        title: "No mail accounts",
                        message: "Create mailboxes in the web panel first.",
                        icon: "envelope"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(users) { user in
                                mailRow(user)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle(openWebmail ? "Webmail" : "Mail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func mailRow(_ user: MailUser) -> some View {
        let mailbox = user.user ?? user.email?.components(separatedBy: "@").first ?? ""
        let content = HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.cyan.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: "envelope.fill")
                    .foregroundStyle(.cyan)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(user.displayName)
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text(user.address.contains("@") ? user.address : "\(user.address)@\(domainName)")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
            Spacer()
            if openWebmail, !mailbox.isEmpty {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

        if openWebmail, !mailbox.isEmpty {
            NavigationLink {
                WebmailView(domainName: domainName, mailboxUser: mailbox)
            } label: {
                content
            }
            .buttonStyle(.plain)
        } else {
            content
        }
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

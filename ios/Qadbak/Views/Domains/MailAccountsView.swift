import SwiftUI

struct MailAccountsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    var openWebmail: Bool = false

    @State private var users: [MailUser] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showAdd = false
    @State private var userToDelete: MailUser?
    @State private var userToChangePassword: MailUser?

    var body: some View {
        QBScreenContainer {
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
                        message: "Create a mailbox for this domain.",
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
        .navigationTitle(openWebmail ? "Qmail" : "Mail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            if !openWebmail {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAdd = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showAdd) {
            NavigationStack {
                AddMailAccountView(domainName: domainName) {
                    showAdd = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete mailbox?", isPresented: Binding(
            get: { userToDelete != nil },
            set: { if !$0 { userToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let user = userToDelete {
                    Task { await delete(user) }
                }
            }
            Button("Cancel", role: .cancel) { userToDelete = nil }
        }
        .sheet(item: $userToChangePassword) { user in
            NavigationStack {
                ChangeMailPasswordView(domainName: domainName, user: user) {
                    userToChangePassword = nil
                }
            }
            .preferredColorScheme(.dark)
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func mailRow(_ user: MailUser) -> some View {
        let mailbox = user.user ?? user.email?.components(separatedBy: "@").first ?? ""
        let content = QBListRow(
            title: user.displayName,
            subtitle: user.address.contains("@") ? user.address : "\(user.address)@\(domainName)",
            icon: "envelope.fill",
            tint: .cyan
        ) {
            if !openWebmail, let mailboxName = user.user, !mailboxName.isEmpty {
                Button {
                    userToChangePassword = user
                } label: {
                    Image(systemName: "key.fill")
                        .foregroundStyle(QadbakPalette.accent)
                }
                Button(role: .destructive) {
                    userToDelete = user
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(QadbakPalette.danger)
                }
            } else if openWebmail, !mailbox.isEmpty {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }

        if openWebmail, !mailbox.isEmpty {
            NavigationLink {
                QmailView(domainName: domainName, mailboxUser: mailbox)
            } label: {
                content
            }
            .buttonStyle(.plain)
        } else {
            content
        }
    }

    private func load() async {
        guard let hosting = appState.hostingAPI else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            users = try await hosting.listMailUsers(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ user: MailUser) async {
        guard let hosting = appState.hostingAPI else { return }
        guard let name = user.user, !name.isEmpty else { return }
        userToDelete = nil
        do {
            try await hosting.deleteMailUser(domainName, user: name)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ChangeMailPasswordView: View {
    let domainName: String
    let user: MailUser
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "Change password",
                        subtitle: user.address.contains("@") ? user.address : "\(user.address)@\(domainName)"
                    )
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        QBTextField(label: "New password", placeholder: "Strong password", text: $password, secure: true)
                    }
                    QBPrimaryButton(title: "Save password", loading: isSaving, disabled: password.count < 8) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Mail password")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss(); onDone() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        guard let mailbox = user.user, !mailbox.isEmpty else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await hosting.updateMailUser(domainName, user: mailbox, pass: password)
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

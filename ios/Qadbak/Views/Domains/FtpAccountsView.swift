import SwiftUI

struct FtpAccountsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var accounts: [FtpAccount] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showCreate = false
    @State private var accountToReset: FtpAccount?
    @State private var accountToDelete: FtpAccount?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && accounts.isEmpty {
                    QBLoadingState(message: "Loading FTP accounts…")
                } else if accounts.isEmpty {
                    QBEmptyState(
                        title: "No FTP accounts",
                        message: "Create FTP users for file uploads.",
                        icon: "arrow.up.arrow.down.circle"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(accounts) { account in
                                ftpRow(account)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("FTP")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .top) { banners }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showCreate = true } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                CreateFtpAccountView(domainName: domainName) {
                    showCreate = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(item: $accountToReset) { account in
            NavigationStack {
                ResetFtpPasswordView(domainName: domainName, user: account.user) {
                    accountToReset = nil
                    successMessage = "Password updated."
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete FTP account?", isPresented: Binding(
            get: { accountToDelete != nil },
            set: { if !$0 { accountToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let account = accountToDelete {
                    Task { await delete(account) }
                }
            }
            Button("Cancel", role: .cancel) { accountToDelete = nil }
        } message: {
            if let account = accountToDelete {
                Text(account.user)
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var banners: some View {
        VStack(spacing: 8) {
            if let errorMessage { ErrorBanner(message: errorMessage) }
            if let successMessage { SuccessBanner(message: successMessage) }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    @ViewBuilder
    private func ftpRow(_ account: FtpAccount) -> some View {
        QBListRow(
            title: account.user,
            subtitle: ftpSubtitle(account),
            icon: "arrow.up.arrow.down.circle",
            tint: Color.teal
        ) {
            Menu {
                Button("Change password") {
                    accountToReset = account
                }
                Button("Delete", role: .destructive) {
                    accountToDelete = account
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private func ftpSubtitle(_ account: FtpAccount) -> String {
        var parts: [String] = []
        if let dir = account.dir, !dir.isEmpty {
            parts.append(dir)
        }
        if let quota = account.quota, !quota.isEmpty {
            parts.append("quota: \(quota)")
        }
        return parts.isEmpty ? "FTP account" : parts.joined(separator: " · ")
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        defer { isLoading = false }
        do {
            accounts = try await api.listFtpAccounts(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ account: FtpAccount) async {
        guard let api = appState.api else { return }
        accountToDelete = nil
        do {
            try await api.deleteFtpAccount(domainName, user: account.user)
            successMessage = "FTP account deleted."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CreateFtpAccountView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var user = ""
    @State private var password = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "New FTP account", subtitle: domainName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Username", placeholder: "ftpuser", text: $user)
                            QBTextField(label: "Password", placeholder: "Strong password", text: $password, secure: true)
                        }
                    }
                    QBPrimaryButton(title: "Create account", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add FTP")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !user.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && password.count >= 8
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await api.createFtpAccount(
                domainName,
                user: user.trimmingCharacters(in: .whitespacesAndNewlines),
                pass: password
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ResetFtpPasswordView: View {
    let domainName: String
    let user: String
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
                    QBScreenHeader(title: "New password", subtitle: user)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        QBTextField(label: "Password", placeholder: "Strong password", text: $password, secure: true)
                    }
                    QBPrimaryButton(title: "Save password", loading: isSaving, disabled: password.count < 8) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("FTP password")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await api.updateFtpPassword(domainName, user: user, pass: password)
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

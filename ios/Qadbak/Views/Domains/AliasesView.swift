import SwiftUI

struct AliasesView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var aliases: [MailAlias] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCreate = false
    @State private var aliasToDelete: MailAlias?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && aliases.isEmpty {
                    QBLoadingState(message: "Loading aliases…")
                } else if aliases.isEmpty {
                    QBEmptyState(
                        title: "No aliases",
                        message: "Forward addresses like sales@ to a mailbox.",
                        icon: "arrow.triangle.branch"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(aliases) { alias in
                                QBListRow(
                                    title: "\(alias.fromLabel)@\(domainName)",
                                    subtitle: "→ \(alias.toLabel)",
                                    icon: "arrow.triangle.branch",
                                    tint: Color.cyan
                                ) {
                                    Button(role: .destructive) {
                                        aliasToDelete = alias
                                    } label: {
                                        Image(systemName: "trash")
                                            .foregroundStyle(QadbakPalette.danger)
                                    }
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Aliases")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .top) {
            if let errorMessage {
                ErrorBanner(message: errorMessage)
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
            }
        }
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
                CreateAliasView(domainName: domainName) {
                    showCreate = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete alias?", isPresented: Binding(
            get: { aliasToDelete != nil },
            set: { if !$0 { aliasToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let alias = aliasToDelete {
                    Task { await delete(alias) }
                }
            }
            Button("Cancel", role: .cancel) { aliasToDelete = nil }
        }
        .preferredColorScheme(.dark)
    }

    private func load() async {
        guard let hosting = appState.hostingAPI else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            aliases = try await hosting.listAliases(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ alias: MailAlias) async {
        guard let hosting = appState.hostingAPI else { return }
        aliasToDelete = nil
        do {
            try await hosting.deleteAlias(domainName, from: alias.fromLabel, to: alias.toLabel)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CreateAliasView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var from = ""
    @State private var to = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "New alias", subtitle: domainName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Alias (before @)", placeholder: "sales", text: $from)
                            QBTextField(label: "Forward to", placeholder: "info@\(domainName)", text: $to, keyboard: .emailAddress)
                        }
                    }
                    QBPrimaryButton(title: "Create alias", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add alias")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !from.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !to.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await hosting.createAlias(
                domainName,
                from: from.trimmingCharacters(in: .whitespacesAndNewlines),
                to: to.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

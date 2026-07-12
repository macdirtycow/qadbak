import SwiftUI

struct RedirectsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var redirects: [DomainRedirect] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCreate = false
    @State private var redirectToDelete: DomainRedirect?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && redirects.isEmpty {
                    QBLoadingState(message: "Loading redirects…")
                } else if redirects.isEmpty {
                    QBEmptyState(
                        title: "No redirects",
                        message: "Add path redirects for moved pages.",
                        icon: "arrow.right.circle"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(redirects) { redirect in
                                QBListRow(
                                    title: redirect.pathLabel,
                                    subtitle: "\(redirect.typeLabel) → \(redirect.destLabel)",
                                    icon: "arrow.right.circle",
                                    tint: Color.orange
                                ) {
                                    Button(role: .destructive) {
                                        redirectToDelete = redirect
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
        .navigationTitle("Redirects")
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
                CreateRedirectView(domainName: domainName) {
                    showCreate = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete redirect?", isPresented: Binding(
            get: { redirectToDelete != nil },
            set: { if !$0 { redirectToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let redirect = redirectToDelete {
                    Task { await delete(redirect) }
                }
            }
            Button("Cancel", role: .cancel) { redirectToDelete = nil }
        }
        .preferredColorScheme(.dark)
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            redirects = try await api.listRedirects(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ redirect: DomainRedirect) async {
        guard let api = appState.api else { return }
        redirectToDelete = nil
        do {
            try await api.deleteRedirect(domainName, path: redirect.pathLabel)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CreateRedirectView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var path = ""
    @State private var dest = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "New redirect", subtitle: domainName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Path", placeholder: "/old-page", text: $path)
                            QBTextField(label: "Destination", placeholder: "https://\(domainName)/new-page", text: $dest, keyboard: .URL)
                        }
                    }
                    QBPrimaryButton(title: "Create redirect", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add redirect")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !dest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await api.createRedirect(
                domainName,
                path: path.trimmingCharacters(in: .whitespacesAndNewlines),
                dest: dest.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

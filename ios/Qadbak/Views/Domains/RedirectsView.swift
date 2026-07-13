import SwiftUI

struct RedirectsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var redirects: [DomainRedirect] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCreate = false
    @State private var redirectToDelete: DomainRedirect?

    private var isExternalHosting: Bool {
        appState.activeServer?.isAgentManaged == true && appState.activeServer?.capabilities.domainHosting == true
    }

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
            VStack(spacing: 8) {
                if isExternalHosting {
                    Text("Linked Hestia panel supports whole-domain redirects only (entire site → destination).")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                }
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                }
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
        guard let hosting = appState.hostingAPI else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            redirects = try await hosting.listRedirects(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ redirect: DomainRedirect) async {
        guard let hosting = appState.hostingAPI else { return }
        redirectToDelete = nil
        do {
            try await hosting.deleteRedirect(domainName, path: redirect.pathLabel)
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

    @State private var path = "/"
    @State private var dest = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isExternalHosting: Bool {
        appState.activeServer?.isAgentManaged == true && appState.activeServer?.capabilities.domainHosting == true
    }

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "New redirect", subtitle: domainName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    if isExternalHosting {
                        Text("Redirects the entire domain to another URL.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            if !isExternalHosting {
                                QBTextField(label: "Path", placeholder: "/old-page", text: $path)
                            }
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
        let pathOk = isExternalHosting || !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return pathOk && !dest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let redirectPath = isExternalHosting ? "/" : path.trimmingCharacters(in: .whitespacesAndNewlines)
            try await hosting.createRedirect(
                domainName,
                path: redirectPath,
                dest: dest.trimmingCharacters(in: .whitespacesAndNewlines),
                type: "301"
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

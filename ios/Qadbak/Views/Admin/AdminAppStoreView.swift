import SwiftUI

struct AdminAppStoreView: View {
    @Environment(AppState.self) private var appState

    @State private var catalog: [AppCatalogEntry] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var search = ""
    @State private var appToInstall: AppCatalogEntry?
    @State private var targetDomain = ""
    @State private var isInstalling = false
    @State private var installResult: AppInstallResult?

    private var filtered: [AppCatalogEntry] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return catalog }
        return catalog.filter {
            ($0.label ?? $0.id).lowercased().contains(q)
                || ($0.tagline ?? "").lowercased().contains(q)
                || ($0.desc ?? "").lowercased().contains(q)
        }
    }

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }
                    if isLoading && catalog.isEmpty {
                        QBLoadingState(message: "Loading app store…")
                            .frame(minHeight: 240)
                    } else if catalog.isEmpty {
                        QBEmptyState(
                            title: "No apps",
                            message: "The server catalog is empty or unavailable.",
                            icon: "square.grid.2x2"
                        )
                    } else {
                        ForEach(filtered) { app in
                            appRow(app)
                        }
                    }
                }
                .padding(20)
            }
            if isInstalling {
                Color.black.opacity(0.35).ignoresSafeArea()
                ProgressView("Installing…")
                    .padding(24)
                    .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .navigationTitle("App store")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Search apps")
        .refreshable { await load() }
        .task { await load() }
        .alert("Install app", isPresented: Binding(
            get: { appToInstall != nil },
            set: { if !$0 { appToInstall = nil } }
        )) {
            TextField("Domain", text: $targetDomain)
            Button("Install") { Task { await install() } }
            Button("Cancel", role: .cancel) { appToInstall = nil }
        } message: {
            if let app = appToInstall {
                Text("Install \(app.label ?? app.id) on which domain?")
            }
        }
        .sheet(item: $installResult) { result in
            NavigationStack {
                installSuccessView(result)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { installResult = nil }
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
        .preferredColorScheme(.dark)
    }

    private func appRow(_ app: AppCatalogEntry) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(app.icon ?? "📦")
                .font(.title2)
                .frame(width: 40)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(app.label ?? app.id)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(QadbakPalette.text)
                    if app.comingSoon == true {
                        Text("Soon")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(QadbakPalette.muted.opacity(0.2), in: Capsule())
                    }
                }
                if let tagline = app.tagline, !tagline.isEmpty {
                    Text(tagline)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }
                if let version = app.version, !version.isEmpty {
                    Text(version)
                        .font(.caption2)
                        .foregroundStyle(QadbakPalette.muted.opacity(0.7))
                }
            }
            Spacer(minLength: 0)
            if app.comingSoon != true {
                Button("Install") {
                    appToInstall = app
                    targetDomain = ""
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .tint(QadbakPalette.accent)
            }
        }
        .padding(12)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private func installSuccessView(_ result: AppInstallResult) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Install complete")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(QadbakPalette.text)
                if let url = result.primaryUrl, let link = URL(string: url) {
                    Link("Open site", destination: link)
                        .font(.subheadline.weight(.semibold))
                }
                if let post = result.postInstall, !post.isEmpty {
                    Text(post)
                        .font(.subheadline)
                        .foregroundStyle(QadbakPalette.muted)
                }
                if let creds = result.credentials, !creds.isEmpty {
                    Text("Credentials")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(QadbakPalette.muted)
                        .textCase(.uppercase)
                    ForEach(creds) { cred in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(cred.label).font(.caption).foregroundStyle(QadbakPalette.muted)
                            Text(cred.value)
                                .font(.subheadline.monospaced())
                                .foregroundStyle(QadbakPalette.text)
                                .textSelection(.enabled)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding(20)
        }
        .navigationTitle("Installed")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await api.appCatalog()
            catalog = (res.catalog ?? []).filter { $0.comingSoon != true }
                .sorted { ($0.label ?? $0.id).localizedCaseInsensitiveCompare($1.label ?? $1.id) == .orderedAscending }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func install() async {
        guard let api = appState.api, let app = appToInstall else { return }
        let domain = targetDomain.trimmingCharacters(in: .whitespaces).lowercased()
        guard !domain.isEmpty else { return }
        isInstalling = true
        defer { isInstalling = false }
        do {
            let templateId = app.intentMode == "domain-only" ? app.id : app.id
            let res = try await api.installApp(templateId: templateId, input: ["domain": domain])
            appToInstall = nil
            if let result = res.result {
                installResult = result
            } else {
                errorMessage = "Install finished but no result returned."
            }
        } catch {
            errorMessage = error.localizedDescription
            appToInstall = nil
        }
    }
}

extension AppInstallResult: Identifiable {
    var id: String { journalId ?? primaryUrl ?? UUID().uuidString }
}

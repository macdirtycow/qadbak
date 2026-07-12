import SwiftUI

struct DomainAppsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var available: [AvailableScript] = []
    @State private var installed: [InstalledScript] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var scriptToInstall: AvailableScript?
    @State private var installPath = "public_html"
    @State private var forceOverwrite = false
    @State private var isInstalling = false
    @State private var scriptToDelete: InstalledScript?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let successMessage {
                        SuccessBanner(message: successMessage)
                    }
                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }
                    if isLoading && available.isEmpty && installed.isEmpty {
                        QBLoadingState(message: "Loading apps…")
                            .frame(minHeight: 200)
                    } else {
                        sectionHeader("Installed")
                        if installed.isEmpty {
                            Text("No one-click apps installed yet.")
                                .font(.subheadline)
                                .foregroundStyle(QadbakPalette.muted)
                        } else {
                            ForEach(installed) { item in
                                installedRow(item)
                            }
                        }
                        sectionHeader("Available")
                        if available.isEmpty {
                            Text("No installers available on this server.")
                                .font(.subheadline)
                                .foregroundStyle(QadbakPalette.muted)
                        } else {
                            ForEach(available) { script in
                                availableRow(script)
                            }
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
        .navigationTitle("Apps")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
        .alert("Install app", isPresented: Binding(
            get: { scriptToInstall != nil },
            set: { if !$0 { scriptToInstall = nil } }
        )) {
            TextField("Install path", text: $installPath)
            Button("Install") { Task { await install() } }
            Button("Cancel", role: .cancel) { scriptToInstall = nil }
        } message: {
            if let script = scriptToInstall {
                Text("Install \(script.name) under \(installPath)?")
            }
        }
        .confirmationDialog("Remove app?", isPresented: Binding(
            get: { scriptToDelete != nil },
            set: { if !$0 { scriptToDelete = nil } }
        )) {
            Button("Remove", role: .destructive) {
                if let item = scriptToDelete { Task { await deleteScript(item) } }
            }
            Button("Cancel", role: .cancel) { scriptToDelete = nil }
        }
        .preferredColorScheme(.dark)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.bold))
            .foregroundStyle(QadbakPalette.muted)
            .textCase(.uppercase)
            .tracking(0.8)
    }

    private func installedRow(_ item: InstalledScript) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(QadbakPalette.success)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(QadbakPalette.text)
                if let path = item.path, !path.isEmpty {
                    Text(path).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
                if let url = item.url, let link = URL(string: url) {
                    Link(url, destination: link)
                        .font(.caption)
                        .lineLimit(1)
                }
            }
            Spacer()
            if appState.isAdmin {
                Button(role: .destructive) { scriptToDelete = item } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .padding(12)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func availableRow(_ script: AvailableScript) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "shippingbox.fill")
                .foregroundStyle(QadbakPalette.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text(script.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(QadbakPalette.text)
                if let desc = script.desc, !desc.isEmpty {
                    Text(desc).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
                if let version = script.version, !version.isEmpty {
                    Text("v\(version)").font(.caption2).foregroundStyle(QadbakPalette.muted.opacity(0.8))
                }
            }
            Spacer()
            if appState.isAdmin {
                Button("Install") {
                    scriptToInstall = script
                    installPath = "public_html"
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .tint(QadbakPalette.accent)
            }
        }
        .padding(12)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await api.listDomainScripts(domainName)
            available = res.available ?? []
            installed = res.installed ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func install() async {
        guard let api = appState.api, let script = scriptToInstall else { return }
        isInstalling = true
        defer { isInstalling = false }
        do {
            _ = try await api.installDomainScript(
                domainName,
                script: script.name,
                path: installPath,
                forceOverwrite: forceOverwrite
            )
            scriptToInstall = nil
            successMessage = "\(script.name) installed."
            await load()
        } catch {
            errorMessage = error.localizedDescription
            scriptToInstall = nil
        }
    }

    private func deleteScript(_ item: InstalledScript) async {
        guard let api = appState.api else { return }
        do {
            try await api.deleteDomainScript(domainName, script: item.name)
            scriptToDelete = nil
            successMessage = "Removed \(item.name)."
            await load()
        } catch {
            errorMessage = error.localizedDescription
            scriptToDelete = nil
        }
    }
}

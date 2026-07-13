import SwiftUI

struct AgentServerControlView: View {
    @Environment(AppState.self) private var appState

    @State private var updates: PackageUpdateInfo?
    @State private var upgradeManifest: AgentReleaseManifest?
    @State private var agentVersion: String?
    @State private var showAgentUpgrade = false
    @State private var isLoading = false
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var pendingPowerAction: PowerAction?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "Server control",
                        subtitle: "Package updates and power actions require confirmation."
                    )

                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    if let successMessage { SuccessBanner(message: successMessage) }

                    agentUpgradeCard
                    updatesCard
                    powerCard
                }
                .padding(20)
            }
            .refreshable { await reload() }
        }
        .navigationTitle("Control")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .sheet(isPresented: $showAgentUpgrade) {
            if let server = appState.activeServer,
               let manifest = upgradeManifest,
               let current = agentVersion,
               let client = appState.activeAgentClient {
                AgentUpgradeView(
                    server: server,
                    manifest: manifest,
                    currentVersion: current,
                    client: client
                ) {
                    Task { await reload() }
                }
            }
        }
        .confirmationDialog(
            pendingPowerAction?.title ?? "Confirm",
            isPresented: Binding(
                get: { pendingPowerAction != nil },
                set: { if !$0 { pendingPowerAction = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button(pendingPowerAction?.buttonLabel ?? "Confirm", role: .destructive) {
                if let pendingPowerAction { Task { await runPowerAction(pendingPowerAction) } }
            }
            Button("Cancel", role: .cancel) { pendingPowerAction = nil }
        } message: {
            Text(pendingPowerAction?.message ?? "")
        }
        .preferredColorScheme(.dark)
    }

    private var agentUpgradeCard: some View {
        Group {
            if let manifest = upgradeManifest,
               let current = agentVersion,
               AgentCompatibility.isAtLeast(manifest.version, required: current),
               manifest.version != current {
                QBGlassCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Qadbak agent", systemImage: "app.connected.to.app.below.fill")
                            .font(.headline)
                            .foregroundStyle(QadbakPalette.text)
                        Text("Installed \(current) · App bundle has \(manifest.version)")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                        Button("Upgrade agent") { showAgentUpgrade = true }
                            .buttonStyle(.borderedProminent)
                            .tint(QadbakPalette.accent)
                    }
                }
            }
        }
    }

    private var updatesCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Package updates", systemImage: "arrow.down.circle")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)

                if isLoading && updates == nil {
                    ProgressView()
                } else if let updates {
                    Text("\(updates.availableCount) upgradable packages")
                        .font(.subheadline)
                        .foregroundStyle(QadbakPalette.text)
                    if updates.rebootRequired {
                        Text("Reboot required after upgrade.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.warning)
                    }
                    if !updates.packages.isEmpty {
                        Text(updates.packages.prefix(8).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                            .lineLimit(3)
                    }
                } else {
                    Text("No update status loaded.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }

                HStack(spacing: 10) {
                    Button("Refresh") { Task { await reload() } }
                        .buttonStyle(.bordered)
                        .tint(QadbakPalette.accent)
                    Button(isBusy ? "Working…" : "Install updates") {
                        Task { await installUpdates() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(QadbakPalette.warning)
                    .disabled(isBusy || (updates?.availableCount ?? 0) == 0)
                }
            }
        }
    }

    private var powerCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Power", systemImage: "power")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text("These actions affect the entire server. Ensure you have console access.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)

                HStack(spacing: 10) {
                    Button("Reboot") { pendingPowerAction = .reboot }
                        .buttonStyle(.bordered)
                        .tint(QadbakPalette.warning)
                        .disabled(isBusy)
                    Button("Shutdown") { pendingPowerAction = .shutdown }
                        .buttonStyle(.bordered)
                        .tint(QadbakPalette.danger)
                        .disabled(isBusy)
                }
            }
        }
    }

    private func reload() async {
        guard let provider = appState.activeProvider else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        upgradeManifest = try? AgentInstallService.loadManifest()
        if let overview = try? await provider.fetchOverview() {
            agentVersion = overview.agentVersion
        }
        do {
            updates = try await provider.fetchUpdates()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func installUpdates() async {
        guard let provider = appState.activeProvider else { return }
        isBusy = true
        errorMessage = nil
        successMessage = nil
        defer { isBusy = false }
        do {
            try await provider.installUpdates()
            successMessage = "Package upgrade started."
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runPowerAction(_ action: PowerAction) async {
        guard let provider = appState.activeProvider else { return }
        isBusy = true
        errorMessage = nil
        successMessage = nil
        defer {
            isBusy = false
            pendingPowerAction = nil
        }
        do {
            switch action {
            case .reboot:
                try await provider.reboot()
                successMessage = "Reboot scheduled."
            case .shutdown:
                try await provider.shutdown()
                successMessage = "Shutdown scheduled."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum PowerAction {
    case reboot
    case shutdown

    var title: String {
        switch self {
        case .reboot: return "Reboot server?"
        case .shutdown: return "Shut down server?"
        }
    }

    var buttonLabel: String {
        switch self {
        case .reboot: return "Reboot"
        case .shutdown: return "Shut down"
        }
    }

    var message: String {
        switch self {
        case .reboot: return "The server will reboot. All services will be interrupted briefly."
        case .shutdown: return "The server will power off. You may need out-of-band access to start it again."
        }
    }
}

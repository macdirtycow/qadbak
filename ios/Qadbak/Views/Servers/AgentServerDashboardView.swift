import SwiftUI

struct AgentServerDashboardView: View {
    @Environment(AppState.self) private var appState

    @State private var overview: ServerOverview?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSwitcher = false
    @State private var showUpgrade = false
    @State private var upgradeManifest: AgentReleaseManifest?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let server = appState.activeServer {
                        header(server)
                        upgradeBanner
                        PanelDetectionCard(server: server)
                    }
                    if isLoading && overview == nil {
                        QBLoadingState(message: "Loading overview…")
                    } else if let overview {
                        metricsGrid(overview)
                        if let provider = appState.activeProvider {
                            featureLinks(provider)
                        }
                    } else if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }
                }
                .padding(20)
            }
            .refreshable { await reload() }
        }
        .navigationTitle(appState.activeServer?.displayName ?? "Server")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showSwitcher = true } label: {
                    Image(systemName: "server.rack").foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .sheet(isPresented: $showSwitcher) { ServerSwitcherView() }
        .sheet(isPresented: $showUpgrade) {
            if let server = appState.activeServer,
               let manifest = upgradeManifest,
               let version = overview?.agentVersion,
               let client = (appState.activeProvider as? QadbakAgentProvider)?.apiClient {
                AgentUpgradeView(
                    server: server,
                    manifest: manifest,
                    currentVersion: version,
                    client: client
                ) {
                    Task { await reload() }
                }
            }
        }
        .task(id: appState.activeServerId) { await reload() }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var upgradeBanner: some View {
        if let manifest = upgradeManifest,
           let current = overview?.agentVersion,
           AgentCompatibility.isAtLeast(manifest.version, required: current),
           manifest.version != current {
            QBGlassCard {
                HStack(spacing: 12) {
                    Image(systemName: "arrow.up.circle.fill")
                        .foregroundStyle(QadbakPalette.warning)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Agent update available")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(QadbakPalette.text)
                        Text("\(current) → \(manifest.version)")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }
                    Spacer()
                    Button("Upgrade") { showUpgrade = true }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
    }

    private func header(_ server: ManagedServer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            QBScreenHeader(title: server.displayName, subtitle: server.displayHost)
            ServerBadgeView(server: server)
            if let os = server.operatingSystem {
                Text(os).font(.caption).foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private func metricsGrid(_ overview: ServerOverview) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            if let cpu = overview.cpuPercent {
                QBStatTile(title: "CPU", value: String(format: "%.0f%%", cpu), icon: "cpu", tone: QadbakPalette.accent)
            }
            if let used = overview.memoryUsedBytes, let total = overview.memoryTotalBytes, total > 0 {
                QBStatTile(title: "Memory", value: formatBytes(used) + " / " + formatBytes(total), icon: "memorychip", tone: .cyan)
            }
            if let used = overview.diskUsedBytes, let total = overview.diskTotalBytes, total > 0 {
                QBStatTile(title: "Disk", value: formatBytes(used) + " / " + formatBytes(total), icon: "internaldrive", tone: QadbakPalette.warning)
            }
            if let uptime = overview.uptimeSeconds {
                QBStatTile(title: "Uptime", value: formatUptime(uptime), icon: "clock", tone: QadbakPalette.success)
            }
            if let load = overview.loadAverage?.first {
                QBStatTile(title: "Load", value: String(format: "%.2f", load), icon: "gauge", tone: .orange)
            }
            if let version = overview.agentVersion {
                QBStatTile(title: "Agent", value: version, icon: "app.connected.to.app.below.fill", tone: QadbakPalette.glow)
            }
        }
    }

    private func featureLinks(_ provider: any ServerManagementProvider) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Explore")
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)

            if provider.supports(.overview) || provider.supports(.metrics) {
                NavigationLink { AgentMetricsView() } label: {
                    featureRow(title: "Metrics", subtitle: "CPU & memory history", icon: "chart.xyaxis.line", tint: .mint)
                }
            }
            if provider.supports(.logs) {
                NavigationLink { AgentAuditView() } label: {
                    featureRow(title: "Audit log", subtitle: "Recent agent actions", icon: "list.bullet.rectangle", tint: QadbakPalette.muted)
                }
            }
            if provider.supports(.services) {
                NavigationLink { AgentServicesView() } label: {
                    featureRow(title: "Services", subtitle: "systemd units (read-only)", icon: "gearshape.2", tint: QadbakPalette.accent)
                }
            }
            if provider.supports(.docker) {
                NavigationLink { AgentDockerView() } label: {
                    featureRow(title: "Docker", subtitle: "Containers (read-only)", icon: "shippingbox", tint: .cyan)
                }
            }
            if provider.supports(.logs) {
                NavigationLink { AgentLogsView() } label: {
                    featureRow(title: "Logs", subtitle: "Journal & service logs", icon: "doc.text", tint: QadbakPalette.warning)
                }
            }
            if provider.supports(.updates) || provider.supports(.reboot) || provider.supports(.shutdown) {
                NavigationLink { AgentServerControlView() } label: {
                    featureRow(title: "Control", subtitle: "Agent upgrade, packages, reboot", icon: "power", tint: QadbakPalette.danger)
                }
            }
        }
    }

    private func featureRow(title: String, subtitle: String, icon: String, tint: Color) -> some View {
        QBGlassCard {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(tint)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(QadbakPalette.text)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private func reload() async {
        guard let provider = appState.activeProvider as? QadbakAgentProvider else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            overview = try await provider.fetchOverview()
            upgradeManifest = try? AgentInstallService.loadManifest()
            if var server = appState.activeServer {
                if let caps = try? await provider.apiClient.capabilities().capabilities?.toServerCapabilities() {
                    server.capabilities = caps
                }
                if let detection = try? await provider.apiClient.panelDetection().panelDetection?.toPanelDetection() {
                    server.panelDetection = detection
                    if let kind = detection.detectedPanel, kind != .genericLinux {
                        server.serverKind = kind
                    }
                }
                appState.updateActiveServerProfile(server)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: bytes, countStyle: .binary)
    }

    private func formatUptime(_ seconds: Int) -> String {
        let d = seconds / 86400
        let h = (seconds % 86400) / 3600
        if d > 0 { return "\(d)d \(h)h" }
        return "\(h)h"
    }
}

import SwiftUI

private struct PanelLinkSheetItem: Identifiable {
    let panel: ServerKind
    var id: String { panel.rawValue }
}

struct PanelDetectionCard: View {
    @Environment(AppState.self) private var appState

    let server: ManagedServer

    @State private var linkStatus: AgentPanelLinkStatusPayload?
    @State private var overview: AgentPanelOverviewPayload?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var linkSheetItem: PanelLinkSheetItem?
    @State private var canAutoSetupHestia = false

    private var liveServer: ManagedServer {
        appState.savedServers.first(where: { $0.id == server.id }) ?? server
    }

    private var detectedKind: ServerKind? {
        if let kind = liveServer.panelDetection?.detectedPanel {
            return kind
        }
        if liveServer.serverKind.isOpenSourceLinkable {
            return liveServer.serverKind
        }
        return nil
    }

    var body: some View {
        if let kind = detectedKind {
            QBGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Detected panel", systemImage: "viewfinder")
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)

                    HStack(spacing: 8) {
                        QBBadge(text: kind.displayName, tone: badgeTone(for: kind))
                        if let confidence = liveServer.panelDetection?.confidence, !confidence.isEmpty {
                            QBBadge(text: "\(confidence) confidence", tone: confidenceTone(confidence))
                        }
                        if linkStatus?.linked == true {
                            QBBadge(text: "Linked", tone: .success)
                        }
                        if liveServer.capabilities.domainHosting {
                            QBBadge(text: "Domains", tone: .success)
                        } else if liveServer.capabilities.panelApps {
                            QBBadge(text: "Apps", tone: .success)
                        }
                    }

                    if let signals = liveServer.panelDetection?.signals, !signals.isEmpty {
                        Text(signals.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }

                    panelBody(for: kind)

                    if isLoading {
                        ProgressView().controlSize(.small)
                    } else if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.danger)
                    }
                }
            }
            .task(id: server.id) {
                await refreshDetectionIfNeeded()
                await reload()
            }
            .sheet(item: $linkSheetItem) { item in
                PanelLinkView(server: liveServer, panel: item.panel) {
                    await reload()
                }
            }
        }
    }

    @ViewBuilder
    private func panelBody(for kind: ServerKind) -> some View {
        if kind.isOpenSourceLinkable {
            if linkStatus?.linked == true {
                linkedOverview
                HStack(spacing: 12) {
                    Button("Refresh") { Task { await reload() } }
                        .font(.caption.weight(.semibold))
                    Button("Unlink", role: .destructive) { Task { await unlink() } }
                        .font(.caption.weight(.semibold))
                }
            } else {
                Text("Link \(kind.displayName) to unlock Domains, mail, DNS, SSL, and backups in the app.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                if kind == .hestiaCP, canAutoSetupHestia {
                    Button("Link HestiaCP automatically") {
                        Task { await autoLinkHestia() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.borderedProminent)
                    .tint(QadbakPalette.accent)
                }
                Button(kind == .hestiaCP && canAutoSetupHestia ? "Enter credentials manually" : "Link \(kind.displayName)") {
                    linkSheetItem = PanelLinkSheetItem(panel: kind)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(QadbakPalette.accent)
            }
        } else if kind == .qadbakPanel {
            Text("Add this host as a Qadbak panel server (panel URL + mobile login) for domains, mail, and terminal.")
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
        } else {
            Text("\(kind.displayName) is detected. Agent linking is available for HestiaCP, Coolify, and CasaOS.")
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
        }
    }

    @ViewBuilder
    private var linkedOverview: some View {
        if let hint = linkStatus?.hint, !hint.isEmpty {
            Text(hint)
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
        }
        if let overview {
            if let version = overview.panelVersion, !version.isEmpty {
                Text("Version \(version)")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
            if let summary = overview.summary, !summary.isEmpty {
                Text(summary.map { "\($0.key): \($0.value.displayString)" }.sorted().joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.text)
            }
            if let items = overview.items, !items.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(items.prefix(6)) { item in
                        HStack {
                            Text(item.title ?? item.id)
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.text)
                            Spacer()
                            if let status = item.status, !status.isEmpty {
                                Text(status)
                                    .font(.caption2)
                                    .foregroundStyle(QadbakPalette.muted)
                            }
                        }
                    }
                }
            }
            if let notes = overview.notes?.first {
                Text(notes)
                    .font(.caption2)
                    .foregroundStyle(QadbakPalette.warning.opacity(0.9))
            }
        }
    }

    private func refreshDetectionIfNeeded() async {
        guard liveServer.panelDetection?.detectedPanel == nil else { return }
        guard let client = appState.ensureAgentClient(for: liveServer) else { return }
        if let detection = try? await client.panelDetection().panelDetection?.toPanelDetection() {
            var updated = liveServer
            updated.panelDetection = detection
            if let kind = detection.detectedPanel, kind != .genericLinux {
                updated.serverKind = kind
            }
            appState.updateServerProfileIfExists(updated)
        }
    }

    private func reload() async {
        guard liveServer.isAgentManaged else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        guard let client = appState.ensureAgentClient(for: liveServer) else {
            errorMessage = "Agent session not available. Re-open this server from the server list."
            return
        }
        do {
            let statusRes = try await client.panelLinkStatus()
            linkStatus = statusRes.status
            if statusRes.status?.linked == true {
                overview = try await client.panelOverview()
            } else {
                overview = nil
            }
            if let setup = statusRes.hestiaSetup {
                canAutoSetupHestia = setup.canAutoSetup == true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func autoLinkHestia() async {
        guard let client = appState.ensureAgentClient(for: liveServer) else {
            errorMessage = "Agent session not available."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await client.hestiaBootstrap(autoLink: true)
            if res.ok == false {
                errorMessage = res.error ?? "Automatic Hestia setup failed."
                linkSheetItem = PanelLinkSheetItem(panel: .hestiaCP)
                return
            }
            if res.linked == true {
                await appState.applyPanelLinkResult(
                    serverId: liveServer.id,
                    panel: .hestiaCP,
                    capabilities: res.capabilities
                )
                await reload()
                return
            }
            errorMessage = "Keys created but link did not complete. Finish in the form."
            linkSheetItem = PanelLinkSheetItem(panel: .hestiaCP)
        } catch {
            errorMessage = error.localizedDescription
            linkSheetItem = PanelLinkSheetItem(panel: .hestiaCP)
        }
    }

    private func unlink() async {
        guard let client = appState.ensureAgentClient(for: liveServer) else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await client.unlinkPanel()
            linkStatus = nil
            overview = nil
            await appState.refreshActiveServerCapabilities()
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func badgeTone(for kind: ServerKind) -> QBBadge.BadgeTone {
        switch kind {
        case .genericLinux, .unknownCustom: return .default
        case .qadbakPanel: return .success
        default: return .default
        }
    }

    private func confidenceTone(_ confidence: String) -> QBBadge.BadgeTone {
        switch confidence.lowercased() {
        case "high": return .success
        case "medium": return .warning
        default: return .default
        }
    }
}

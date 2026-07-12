import SwiftUI

struct PanelDetectionCard: View {
    @Environment(AppState.self) private var appState

    let server: ManagedServer

    @State private var linkStatus: AgentPanelLinkStatusPayload?
    @State private var overview: AgentPanelOverviewPayload?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showLinkSheet = false

    var body: some View {
        if let detection = server.panelDetection, let kind = detection.detectedPanel {
            QBGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Detected panel", systemImage: "viewfinder")
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)

                    HStack(spacing: 8) {
                        QBBadge(text: kind.displayName, tone: badgeTone(for: kind))
                        if let confidence = detection.confidence, !confidence.isEmpty {
                            QBBadge(text: "\(confidence) confidence", tone: confidenceTone(confidence))
                        }
                        if linkStatus?.linked == true {
                            QBBadge(text: "Linked", tone: .success)
                        }
                    }

                    if let signals = detection.signals, !signals.isEmpty {
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
            .task(id: server.id) { await reload() }
            .sheet(isPresented: $showLinkSheet) {
                if kind.isOpenSourceLinkable {
                    PanelLinkView(server: server, panel: kind) {
                        await reload()
                    }
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
                Text("Link \(kind.displayName) with an API token or admin login. Read-only for now — system tasks use the Linux agent below.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                Button("Link \(kind.displayName)") { showLinkSheet = true }
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

    private func reload() async {
        guard server.isAgentManaged else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        guard let client = appState.makeAgentClient(for: server) else { return }
        do {
            let statusRes = try await client.panelLinkStatus()
            linkStatus = statusRes.status
            if statusRes.status?.linked == true {
                overview = try await client.panelOverview()
            } else {
                overview = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func unlink() async {
        guard let client = appState.makeAgentClient(for: server) else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await client.unlinkPanel()
            linkStatus = nil
            overview = nil
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

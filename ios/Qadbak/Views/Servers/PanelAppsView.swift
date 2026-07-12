import SwiftUI

struct PanelAppsView: View {
    @Environment(AppState.self) private var appState

    @State private var apps: [PanelApp] = []
    @State private var linkedPanel: String?
    @State private var isLoading = false
    @State private var actionInFlight: String?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showSwitcher = false

    private var canManageApps: Bool {
        linkedPanel?.lowercased() == "coolify"
    }

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    if let successMessage { SuccessBanner(message: successMessage) }
                    if isLoading && apps.isEmpty {
                        QBLoadingState(message: "Loading apps…")
                    } else if apps.isEmpty {
                        QBEmptyState(
                            title: "No apps",
                            message: emptyMessage,
                            icon: "shippingbox"
                        )
                        .frame(minHeight: 240)
                    } else {
                        LazyVStack(spacing: 10) {
                            ForEach(apps) { app in
                                appCard(app)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .refreshable { await reload() }
        }
        .navigationTitle("Apps")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showSwitcher = true } label: {
                    Image(systemName: "server.rack")
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .sheet(isPresented: $showSwitcher) { ServerSwitcherView() }
        .task { await reload() }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(appState.activeServer?.displayName ?? "Linked panel")
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
        }
    }

    private var subtitle: String {
        if canManageApps {
            return "Deploy, start, and stop Coolify applications from your phone."
        }
        if linkedPanel?.lowercased() == "casaos" {
            return "Installed CasaOS apps on this server. Install and configure apps in the CasaOS UI."
        }
        return "Applications from your linked panel."
    }

    private var emptyMessage: String {
        if canManageApps {
            return "No Coolify applications found. Create one in Coolify first."
        }
        return "No applications reported by the linked panel."
    }

    private func appCard(_ app: PanelApp) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(app.name)
                            .font(.headline)
                            .foregroundStyle(QadbakPalette.text)
                        if let detail = app.detail, !detail.isEmpty {
                            Text(detail)
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.muted)
                        }
                        if let image = app.image, !image.isEmpty {
                            Text(image)
                                .font(.caption2)
                                .foregroundStyle(QadbakPalette.muted.opacity(0.8))
                        }
                    }
                    Spacer()
                    if let status = app.status, !status.isEmpty {
                        QBBadge(text: status, tone: statusTone(status))
                    }
                }
                if canManageApps {
                    HStack(spacing: 10) {
                        actionButton("Deploy", action: "deploy", app: app)
                        actionButton("Start", action: "start", app: app)
                        actionButton("Stop", action: "stop", app: app, destructive: true)
                    }
                }
            }
        }
    }

    private func actionButton(_ title: String, action: String, app: PanelApp, destructive: Bool = false) -> some View {
        let key = "\(app.id)-\(action)"
        let loading = actionInFlight == key
        return Button {
            Task { await runAction(action, app: app) }
        } label: {
            if loading {
                ProgressView().controlSize(.small)
            } else {
                Text(title)
                    .font(.caption.weight(.semibold))
            }
        }
        .buttonStyle(.bordered)
        .tint(destructive ? QadbakPalette.danger : QadbakPalette.accent)
        .disabled(actionInFlight != nil)
    }

    private func statusTone(_ status: String) -> QBBadge.BadgeTone {
        let lower = status.lowercased()
        if lower.contains("run") || lower.contains("active") || lower.contains("healthy") {
            return .success
        }
        if lower.contains("stop") || lower.contains("exit") || lower.contains("fail") {
            return .danger
        }
        return .default
    }

    private func reload() async {
        guard let server = appState.activeServer,
              let client = appState.makeAgentClient(for: server) else { return }
        await load(with: client)
    }

    private func load(with client: AgentAPIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            if let status = try? await client.panelLinkStatus().status {
                linkedPanel = status.panel
            }
            apps = try await client.listPanelApps()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runAction(_ action: String, app: PanelApp) async {
        guard let server = appState.activeServer,
              let client = appState.makeAgentClient(for: server) else { return }
        let key = "\(app.id)-\(action)"
        actionInFlight = key
        errorMessage = nil
        successMessage = nil
        defer { actionInFlight = nil }
        do {
            try await AgentConfirmedAction.confirmAndRun(
                client: client,
                action: "panel.app.\(action)",
                target: app.id
            ) { token in
                _ = try await client.panelAppAction(id: app.id, action: action, confirmToken: token)
            }
            successMessage = "\(app.name): \(action) requested."
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

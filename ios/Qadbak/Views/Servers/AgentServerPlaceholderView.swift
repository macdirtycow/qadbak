import SwiftUI

struct AgentServerPlaceholderView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let server = appState.activeServer {
                        QBScreenHeader(
                            title: server.displayName,
                            subtitle: server.displayHost
                        )
                        ServerBadgeView(server: server)

                        statusCard(server)

                        QBGlassCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Agent dashboard")
                                    .font(.headline)
                                    .foregroundStyle(QadbakPalette.text)
                                Text("Metrics, services, Docker, and logs will appear here after phase 2 pairing completes.")
                                    .font(.subheadline)
                                    .foregroundStyle(QadbakPalette.muted)
                            }
                        }

                        if !server.capabilities.systemMetrics {
                            VStack(alignment: .leading, spacing: 8) {
                                QBSectionHeader(title: "Planned modules")
                                Text("Overview · Services · Docker · Logs · Updates")
                                    .font(.caption)
                                    .foregroundStyle(QadbakPalette.muted)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle(appState.activeServer?.displayName ?? "Server")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }

    private func statusCard(_ server: ManagedServer) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Status")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Label(statusLabel(server.connectionStatus), systemImage: statusIcon(server.connectionStatus))
                    .font(.subheadline)
                    .foregroundStyle(statusColor(server.connectionStatus))
                if server.authenticationMethod == .agentTokenPendingPair {
                    Text("Complete SSH onboarding to install and pair the Qadbak Agent.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }
            }
        }
    }

    private var capabilityPreview: some View {
        QBSectionHeader(title: "Planned modules")
            .padding(.top, 8)
            + Text("Overview · Services · Docker · Logs · Updates")
            .font(.caption)
            .foregroundStyle(QadbakPalette.muted)
    }

    private func statusLabel(_ status: ConnectionStatus) -> String {
        switch status {
        case .connecting: return "Connecting…"
        case .installingAgent: return "Installing agent…"
        case .pairing: return "Pairing…"
        case .online: return "Online"
        case .degraded: return "Degraded"
        case .offline: return "Offline"
        case .authFailed: return "Authentication failed"
        case .agentUpdateRequired: return "Agent update required"
        case .unsupportedOS: return "Unsupported operating system"
        }
    }

    private func statusIcon(_ status: ConnectionStatus) -> String {
        switch status {
        case .online: return "checkmark.circle.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .offline, .authFailed, .unsupportedOS: return "xmark.circle.fill"
        default: return "ellipsis.circle"
        }
    }

    private func statusColor(_ status: ConnectionStatus) -> Color {
        switch status {
        case .online: return QadbakPalette.success
        case .degraded: return QadbakPalette.warning
        case .offline, .authFailed, .unsupportedOS: return QadbakPalette.danger
        default: return QadbakPalette.muted
        }
    }
}
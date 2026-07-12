import SwiftUI

struct ServerBadgeView: View {
    let server: ManagedServer

    var body: some View {
        HStack(spacing: 4) {
            if !server.connectionStatus.isReachable && server.isAgentManaged {
                badge("Offline", tone: .danger)
            }
            badge(primaryLabel, tone: primaryTone)
            if let panelBadge = panelBadgeLabel {
                badge(panelBadge, tone: .default)
            }
            if server.isBetaAgent {
                badge("Beta", tone: .warning)
            }
        }
    }

    private var primaryLabel: String {
        if server.isQadbakPanel { return "Qadbak" }
        if server.isAgentManaged { return "Linux Agent" }
        return server.serverKind.displayName
    }

    private var primaryTone: QBBadge.BadgeTone {
        if server.isQadbakPanel { return .success }
        if !server.connectionStatus.isReachable { return .danger }
        return .default
    }

    /// Secondary badge when a hosting panel was detected alongside the agent.
    private var panelBadgeLabel: String? {
        guard server.isAgentManaged else { return nil }
        let kind = server.panelDetection?.detectedPanel ?? server.serverKind
        guard kind != .genericLinux, kind != .unknownCustom else { return nil }
        return kind.displayName
    }

    private func badge(_ text: String, tone: QBBadge.BadgeTone) -> some View {
        QBBadge(text: text, tone: tone)
    }
}

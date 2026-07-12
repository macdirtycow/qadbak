import SwiftUI

struct ServerBadgeView: View {
    let server: ManagedServer

    var body: some View {
        HStack(spacing: 4) {
            if !server.connectionStatus.isReachable && server.isAgentManaged {
                badge("Offline", tone: .danger)
            }
            badge(label, tone: tone)
        }
    }

    private var label: String {
        if server.isQadbakPanel { return "Qadbak" }
        if server.isAgentManaged { return server.serverKind.badgeLabel }
        return server.serverKind.displayName
    }

    private var tone: QBBadge.BadgeTone {
        if server.isQadbakPanel { return .default }
        if server.isBetaAgent { return .warning }
        switch server.serverKind {
        case .hestiaCP, .coolify, .casaOS, .plesk, .directAdmin:
            return .default
        default:
            return .default
        }
    }

    private func badge(_ text: String, tone: QBBadge.BadgeTone) -> some View {
        QBBadge(text: text, tone: tone)
    }
}

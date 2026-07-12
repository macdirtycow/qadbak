import SwiftUI

struct PanelDetectionCard: View {
    let server: ManagedServer

    var body: some View {
        if let detection = server.panelDetection {
            QBGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Panel detection", systemImage: "viewfinder")
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)

                    HStack(spacing: 8) {
                        if let kind = detection.detectedPanel {
                            QBBadge(text: kind.displayName, tone: badgeTone(for: kind))
                        }
                        if let confidence = detection.confidence, !confidence.isEmpty {
                            QBBadge(text: "\(confidence) confidence", tone: confidenceTone(confidence))
                        }
                    }

                    if let signals = detection.signals, !signals.isEmpty {
                        Text(signals.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }

                    Text("Informational only — the agent does not manage third-party panels.")
                        .font(.caption2)
                        .foregroundStyle(QadbakPalette.warning.opacity(0.9))
                }
            }
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

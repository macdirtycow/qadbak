import SwiftUI

struct AdminHealthView: View {
    @Environment(AppState.self) private var appState

    @State private var report: HealthReport?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && report == nil {
                    QBLoadingState(message: "Running health checks…")
                } else if let report {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            QBScreenHeader(
                                title: "Server health",
                                subtitle: report.generatedAt ?? "Latest panel checks"
                            )
                            if let counts = report.counts {
                                countsRow(counts)
                            }
                            if let findings = report.findings, !findings.isEmpty {
                                QBSectionHeader(title: "Findings")
                                LazyVStack(spacing: 10) {
                                    ForEach(findings) { finding in
                                        findingCard(finding)
                                    }
                                }
                            } else {
                                QBEmptyState(
                                    title: "All clear",
                                    message: "No warnings or critical issues were detected.",
                                    icon: "checkmark.seal"
                                )
                                .padding(.vertical, 24)
                            }
                        }
                        .padding(20)
                    }
                } else if let errorMessage {
                    VStack(spacing: 12) {
                        ErrorBanner(message: errorMessage)
                        QBEmptyState(title: "Unavailable", message: "Could not load health report.", icon: "heart.slash")
                    }
                    .padding(20)
                }
            }
        }
        .navigationTitle("Health")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    private func countsRow(_ counts: HealthCounts) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            QBStatTile(title: "Critical", value: "\(counts.critical ?? 0)", icon: "exclamationmark.octagon", tone: QadbakPalette.danger)
            QBStatTile(title: "Warnings", value: "\(counts.warning ?? 0)", icon: "exclamationmark.triangle", tone: QadbakPalette.warning)
        }
    }

    private func findingCard(_ finding: HealthFinding) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(finding.title ?? finding.id)
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)
                    Spacer()
                    QBBadge(text: (finding.severity ?? "info").capitalized, tone: badgeTone(finding.severity))
                }
                if let explanation = finding.explanation, !explanation.isEmpty {
                    Text(explanation)
                        .font(.subheadline)
                        .foregroundStyle(QadbakPalette.muted)
                }
                if let suggestion = finding.suggestion, !suggestion.isEmpty {
                    Text(suggestion)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
    }

    private func badgeTone(_ severity: String?) -> QBBadge.BadgeTone {
        switch severity?.lowercased() {
        case "critical": return .danger
        case "warning": return .warning
        default: return .default
        }
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            report = try await api.adminHealth()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

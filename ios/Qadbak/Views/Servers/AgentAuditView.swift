import SwiftUI

struct AgentAuditView: View {
    @Environment(AppState.self) private var appState

    @State private var entries: [AgentAuditEntry] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && entries.isEmpty {
                    QBLoadingState(message: "Loading audit log…")
                } else if entries.isEmpty, errorMessage == nil {
                    QBEmptyState(
                        title: "No audit entries",
                        message: "Destructive actions and auth events appear here.",
                        icon: "list.bullet.rectangle"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if let errorMessage { ErrorBanner(message: errorMessage) }
                            ForEach(entries.reversed()) { entry in
                                auditRow(entry)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Audit log")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .preferredColorScheme(.dark)
    }

    private func auditRow(_ entry: AgentAuditEntry) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(entry.action ?? "unknown")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(QadbakPalette.text)
                    Spacer()
                    Text(entry.result ?? "")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(resultColor(entry.result))
                }
                if let target = entry.target, !target.isEmpty {
                    Text(target)
                        .font(.caption.monospaced())
                        .foregroundStyle(QadbakPalette.muted)
                }
                HStack {
                    Text(formatTimestamp(entry.ts))
                        .font(.caption2)
                        .foregroundStyle(QadbakPalette.muted)
                    if let ip = entry.sourceIp, !ip.isEmpty {
                        Text(ip)
                            .font(.caption2.monospaced())
                            .foregroundStyle(QadbakPalette.muted.opacity(0.8))
                    }
                }
            }
        }
    }

    private func resultColor(_ result: String?) -> Color {
        guard let result else { return QadbakPalette.muted }
        return result.lowercased() == "ok" ? QadbakPalette.success : QadbakPalette.warning
    }

    private func reload() async {
        guard let client = (appState.activeProvider as? QadbakAgentProvider)?.apiClient else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            entries = try await client.auditLog(tail: 200)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func formatTimestamp(_ raw: String?) -> String {
        guard let raw else { return "—" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw) {
            return date.formatted(date: .abbreviated, time: .standard)
        }
        return raw
    }
}

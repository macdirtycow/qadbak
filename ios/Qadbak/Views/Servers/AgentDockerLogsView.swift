import SwiftUI

struct AgentDockerLogsView: View {
    let container: ManagedContainer

    @Environment(AppState.self) private var appState

    @State private var lines: [String] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && lines.isEmpty {
                    QBLoadingState(message: "Loading container logs…")
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if let errorMessage { ErrorBanner(message: errorMessage) }
                            if lines.isEmpty {
                                Text("No log lines returned.")
                                    .font(.subheadline)
                                    .foregroundStyle(QadbakPalette.muted)
                            } else {
                                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                                    Text(line)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(QadbakPalette.text)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle(container.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .preferredColorScheme(.dark)
    }

    private func reload() async {
        guard let client = (appState.activeProvider as? QadbakAgentProvider)?.apiClient else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            lines = try await client.dockerLogs(containerId: container.id, tail: 300)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

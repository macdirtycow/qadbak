import SwiftUI

struct AgentDockerView: View {
    @Environment(AppState.self) private var appState

    @State private var containers: [ManagedContainer] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var pendingAction: PendingContainerAction?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && containers.isEmpty {
                    QBLoadingState(message: "Loading containers…")
                } else if containers.isEmpty, errorMessage == nil {
                    QBEmptyState(
                        title: "No containers",
                        message: "Docker is available but no containers were found.",
                        icon: "shippingbox"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if let errorMessage { ErrorBanner(message: errorMessage) }
                            if let successMessage { SuccessBanner(message: successMessage) }
                            ForEach(containers) { container in
                                containerRow(container)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Docker")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .confirmationDialog(
            pendingAction?.title ?? "Confirm",
            isPresented: Binding(
                get: { pendingAction != nil },
                set: { if !$0 { pendingAction = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button(pendingAction?.buttonLabel ?? "Confirm", role: .destructive) {
                if let pendingAction { Task { await runAction(pendingAction) } }
            }
            Button("Cancel", role: .cancel) { pendingAction = nil }
        } message: {
            Text(pendingAction?.message ?? "")
        }
        .preferredColorScheme(.dark)
    }

    private func containerRow(_ container: ManagedContainer) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(container.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(QadbakPalette.text)
                    Spacer()
                    Menu {
                        Button("Restart") { pendingAction = .restart(container) }
                        Button("Start") { pendingAction = .start(container) }
                        Button("Stop", role: .destructive) { pendingAction = .stop(container) }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                    Text(container.status)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(statusColor(container.status))
                }
                Text(container.image)
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                    .lineLimit(1)
                Text(String(container.id.prefix(12)))
                    .font(.caption2.monospaced())
                    .foregroundStyle(QadbakPalette.muted.opacity(0.8))
            }
        }
    }

    private func statusColor(_ status: String) -> Color {
        let lower = status.lowercased()
        if lower.contains("up") || lower.contains("running") {
            return QadbakPalette.success
        }
        if lower.contains("exited") || lower.contains("dead") {
            return QadbakPalette.warning
        }
        return QadbakPalette.muted
    }

    private func reload() async {
        guard let provider = appState.activeProvider else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            containers = try await provider.fetchContainers()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runAction(_ action: PendingContainerAction) async {
        guard let provider = appState.activeProvider as? QadbakAgentProvider else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        defer {
            isLoading = false
            pendingAction = nil
        }
        do {
            switch action {
            case .restart(let container):
                try await provider.restartContainer(id: container.id)
                successMessage = "\(container.name) restarted."
            case .start(let container):
                try await provider.startContainer(id: container.id)
                successMessage = "\(container.name) started."
            case .stop(let container):
                try await provider.stopContainer(id: container.id)
                successMessage = "\(container.name) stopped."
            }
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum PendingContainerAction {
    case restart(ManagedContainer)
    case start(ManagedContainer)
    case stop(ManagedContainer)

    var title: String {
        switch self {
        case .restart: return "Restart container?"
        case .start: return "Start container?"
        case .stop: return "Stop container?"
        }
    }

    var buttonLabel: String {
        switch self {
        case .restart: return "Restart"
        case .start: return "Start"
        case .stop: return "Stop"
        }
    }

    var message: String {
        switch self {
        case .restart(let c): return "Restart \(c.name)?"
        case .start(let c): return "Start \(c.name)?"
        case .stop(let c): return "Stop \(c.name)? Running workloads will halt."
        }
    }
}

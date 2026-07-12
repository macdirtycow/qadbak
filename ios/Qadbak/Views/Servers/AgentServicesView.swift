import SwiftUI

struct AgentServicesView: View {
    @Environment(AppState.self) private var appState

    @State private var services: [ManagedService] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var pendingAction: PendingServiceAction?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && services.isEmpty {
                    QBLoadingState(message: "Loading services…")
                } else if services.isEmpty, errorMessage == nil {
                    QBEmptyState(
                        title: "No services",
                        message: "No running or failed systemd units were returned.",
                        icon: "gearshape.2"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if let errorMessage { ErrorBanner(message: errorMessage) }
                            if let successMessage { SuccessBanner(message: successMessage) }
                            ForEach(services) { service in
                                serviceRow(service)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Services")
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

    private func serviceRow(_ service: ManagedService) -> some View {
        QBGlassCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: statusIcon(service.status))
                    .foregroundStyle(statusColor(service.status))
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 4) {
                    Text(service.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(QadbakPalette.text)
                    if let desc = service.description, !desc.isEmpty {
                        Text(desc)
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                            .lineLimit(2)
                    }
                    Text(service.status.capitalized)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(statusColor(service.status))
                }
                Spacer()
                if service.canManage {
                    Menu {
                        Button("Restart") { pendingAction = .restart(service) }
                        Button("Start") { pendingAction = .start(service) }
                        Button("Stop", role: .destructive) { pendingAction = .stop(service) }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status.lowercased() {
        case "active", "running": return "checkmark.circle.fill"
        case "failed": return "exclamationmark.triangle.fill"
        default: return "minus.circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "active", "running": return QadbakPalette.success
        case "failed": return QadbakPalette.danger
        default: return QadbakPalette.muted
        }
    }

    private func reload() async {
        guard let provider = appState.activeProvider else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            services = try await provider.fetchServices()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runAction(_ action: PendingServiceAction) async {
        guard let provider = appState.activeProvider else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        defer {
            isLoading = false
            pendingAction = nil
        }
        do {
            switch action {
            case .restart(let service):
                try await provider.restartService(id: service.id)
                successMessage = "\(service.name) restarted."
            case .start(let service):
                try await provider.startService(id: service.id)
                successMessage = "\(service.name) started."
            case .stop(let service):
                try await provider.stopService(id: service.id)
                successMessage = "\(service.name) stopped."
            }
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum PendingServiceAction {
    case restart(ManagedService)
    case start(ManagedService)
    case stop(ManagedService)

    var title: String {
        switch self {
        case .restart: return "Restart service?"
        case .start: return "Start service?"
        case .stop: return "Stop service?"
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
        case .restart(let s): return "Restart \(s.name)? This may interrupt traffic."
        case .start(let s): return "Start \(s.name)?"
        case .stop(let s): return "Stop \(s.name)? Dependent services may be affected."
        }
    }
}

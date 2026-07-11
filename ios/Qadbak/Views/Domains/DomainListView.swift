import SwiftUI

struct DomainListView: View {
    @Environment(AppState.self) private var appState
    @State private var domains: [HostedDomain] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && domains.isEmpty {
                    ProgressView("Loading domains…")
                } else if let errorMessage, domains.isEmpty {
                    ContentUnavailableView(
                        "Could not load domains",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                } else if domains.isEmpty {
                    ContentUnavailableView(
                        "No domains",
                        systemImage: "globe",
                        description: Text("Your account has no hosted domains yet.")
                    )
                } else {
                    List(domains) { domain in
                        NavigationLink(value: domain) {
                            DomainRow(domain: domain)
                        }
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Domains")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if appState.isClientAccount {
                        Text("Client")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(QadbakTheme.accent.opacity(0.15), in: Capsule())
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let user = appState.username {
                            Text(user)
                        }
                        if let role = appState.role {
                            Text(role.capitalized)
                                .foregroundStyle(.secondary)
                        }
                        Divider()
                        Button("Sign out", role: .destructive) {
                            Task { await appState.logout() }
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }
            }
            .navigationDestination(for: HostedDomain.self) { domain in
                DomainDetailView(domain: domain)
            }
            .task {
                await load()
                await appState.refreshSessionInfo()
            }
        }
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            domains = try await api.listDomains()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct DomainRow: View {
    let domain: HostedDomain

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(domain.name)
                .font(.headline)
            HStack(spacing: 8) {
                if domain.disabled == true {
                    Label("Disabled", systemImage: "pause.circle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                if let plan = domain.plan, !plan.isEmpty {
                    Text(plan)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let user = domain.user, !user.isEmpty {
                    Text(user)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

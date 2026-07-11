import SwiftUI

struct DomainListView: View {
    @Environment(AppState.self) private var appState
    @State private var domains: [HostedDomain] = []
    @State private var summary: WidgetSummary?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var navigationPath = NavigationPath()

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        NavigationStack(path: $navigationPath) {
            QBScreenContainer {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header
                        if let summary {
                            statsRow(summary)
                        }
                        if let errorMessage, domains.isEmpty {
                            ErrorBanner(message: errorMessage)
                        }
                        content
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
                }
                .refreshable { await reload() }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        QadbakLogoMark(size: 28)
                        Text("Qadbak")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(QadbakPalette.text)
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    if appState.isClientAccount {
                        Text("Client")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .foregroundStyle(QadbakPalette.accent)
                            .background(QadbakPalette.glow.opacity(0.2), in: Capsule())
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
                        if let host = appState.serverURL?.host {
                            Text(host)
                                .font(.caption)
                        }
                        Divider()
                        Button("Sign out", role: .destructive) {
                            Task { await appState.logout() }
                        }
                    } label: {
                        Image(systemName: "person.crop.circle")
                            .font(.title3)
                            .foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
            .toolbarBackground(QadbakPalette.bg.opacity(0.9), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationDestination(for: HostedDomain.self) { domain in
                DomainDetailView(domain: domain)
            }
            .task { await reload() }
            .onChange(of: appState.pendingPushDomain) { _, domain in
                guard let domain, !domain.isEmpty else { return }
                if let match = domains.first(where: { $0.name.lowercased() == domain.lowercased() }) {
                    navigationPath.append(match)
                }
                appState.pendingPushDomain = nil
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var header: some View {
        QBScreenHeader(
            title: "Your domains",
            subtitle: appState.username.map { "Signed in as \($0)" }
        )
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && domains.isEmpty {
            QBLoadingState(message: "Loading domains…")
                .frame(minHeight: 280)
        } else if domains.isEmpty {
            QBEmptyState(
                title: "No domains yet",
                message: "Your account has no hosted domains, or the server could not be reached.",
                icon: "globe.europe.africa"
            )
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
        } else {
            LazyVStack(spacing: 12) {
                ForEach(domains) { domain in
                    NavigationLink(value: domain) {
                        DomainCard(domain: domain)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func statsRow(_ summary: WidgetSummary) -> some View {
        LazyVGrid(columns: columns, spacing: 12) {
            QBStatTile(
                title: "Running",
                value: "\(summary.websitesRunning ?? summary.domainCount)",
                icon: "checkmark.circle",
                tone: QadbakPalette.success
            )
            QBStatTile(
                title: "SSL < 14d",
                value: "\(summary.sslExpiringSoon)",
                icon: "lock.shield",
                tone: summary.sslExpiringSoon > 0 ? QadbakPalette.warning : QadbakPalette.success
            )
            QBStatTile(
                title: "Containers",
                value: "\(summary.containersStopped ?? 0)",
                icon: "shippingbox",
                tone: (summary.containersStopped ?? 0) > 0 ? QadbakPalette.danger : QadbakPalette.success
            )
            QBStatTile(
                title: "Warnings",
                value: "\(summary.urgentActions)",
                icon: "bell.badge",
                tone: summary.urgentActions > 0 ? QadbakPalette.danger : QadbakPalette.muted
            )
        }
    }

    private func reload() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let domainList = api.listDomains()
            async let widget = api.widgetSummary()
            domains = try await domainList
            let widgetData = try await widget
            summary = widgetData
            WidgetSummaryStore.save(widgetData)
            await appState.refreshSessionInfo()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct DomainCard: View {
    let domain: HostedDomain

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(QadbakPalette.glow.opacity(0.2))
                    .frame(width: 48, height: 48)
                Image(systemName: "server.rack")
                    .foregroundStyle(QadbakPalette.primary)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(domain.name)
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                HStack(spacing: 8) {
                    if domain.disabled == true {
                        statusPill("Paused", color: QadbakPalette.warning)
                    }
                    if let plan = domain.plan, !plan.isEmpty {
                        Text(plan)
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }
                    if let user = domain.user, !user.isEmpty {
                        Text(user)
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted.opacity(0.8))
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(QadbakPalette.muted.opacity(0.5))
        }
        .padding(16)
        .background(QadbakPalette.card.opacity(0.95), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.55), lineWidth: 1)
        }
    }

    private func statusPill(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }
}

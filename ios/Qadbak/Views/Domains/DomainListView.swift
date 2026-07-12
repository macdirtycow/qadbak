import SwiftUI

struct DomainListView: View {
    @Environment(AppState.self) private var appState
    @State private var domains: [HostedDomain] = []
    @State private var summary: WidgetSummary?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var navigationPath = NavigationPath()
    @State private var showServerSwitcher = false
    @State private var showAddDomain = false

    private enum AdminRoute: Hashable {
        case panelUpdates
        case serverTerminal
    }

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
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showServerSwitcher = true
                    } label: {
                        Image(systemName: "server.rack")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                    .accessibilityLabel(appState.activeServer?.label ?? "Switch server")
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        QadbakLogoMark(size: 28)
                        Text("Qadbak")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(QadbakPalette.text)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        if appState.isAdmin {
                            Button {
                                showAddDomain = true
                            } label: {
                                Image(systemName: "plus")
                                    .foregroundStyle(QadbakPalette.accent)
                            }
                        }
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
                        if let plan = appState.premiumPlanLabel {
                            Text(plan)
                                .font(.caption.weight(.semibold))
                        }
                        Divider()
                        if appState.isAdmin {
                            Button {
                                showAddDomain = true
                            } label: {
                                Label("Add domain", systemImage: "plus.circle")
                            }
                            Button {
                                navigationPath.append(AdminRoute.panelUpdates)
                            } label: {
                                Label("Panel updates", systemImage: "arrow.triangle.2.circlepath")
                            }
                            Button {
                                navigationPath.append(AdminRoute.serverTerminal)
                            } label: {
                                Label("Server terminal", systemImage: "terminal")
                            }
                        }
                        Divider()
                        Link(destination: URL(string: "https://license.inveil.dev/buy")!) {
                            Label("Support Qadbak", systemImage: "heart.fill")
                        }
                        Button("Switch server") {
                            showServerSwitcher = true
                        }
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
            }
            .sheet(isPresented: $showAddDomain) {
                NavigationStack {
                    AddDomainView {
                        Task { await reload() }
                    }
                }
                .preferredColorScheme(.dark)
            }
            .sheet(isPresented: $showServerSwitcher) {
                ServerSwitcherView()
            }
            .toolbarBackground(QadbakPalette.bg.opacity(0.9), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationDestination(for: HostedDomain.self) { domain in
                DomainDetailView(domain: domain)
            }
            .navigationDestination(for: AdminRoute.self) { route in
                switch route {
                case .panelUpdates:
                    PanelUpdatesView()
                case .serverTerminal:
                    DomainTerminalView(domainName: "", adminShell: true)
                }
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
            subtitle: headerSubtitle
        )
    }

    private var headerSubtitle: String? {
        var parts: [String] = []
        if let user = appState.username { parts.append(user) }
        if let server = appState.activeServer?.label { parts.append(server) }
        if appState.premiumActive, let plan = appState.premiumPlanLabel {
            parts.append(shortPremiumLabel(plan))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func shortPremiumLabel(_ label: String) -> String {
        if let open = label.firstIndex(of: "("),
           let close = label.lastIndex(of: ")"),
           open < close {
            let inner = label[label.index(after: open)..<close].trimmingCharacters(in: .whitespaces)
            if !inner.isEmpty {
                return inner.prefix(1).uppercased() + inner.dropFirst()
            }
        }
        if label.lowercased().contains("premium") { return "Premium" }
        return label
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
                title: "SSL expiring",
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
                    if let plan = domain.plan, !plan.isEmpty, plan.lowercased() != "default" {
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

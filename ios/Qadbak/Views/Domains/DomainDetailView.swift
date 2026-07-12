import SwiftUI

struct DomainDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var domain: HostedDomain
    @State private var isTogglingHosting = false
    @State private var toggleError: String?

    init(domain: HostedDomain) {
        _domain = State(initialValue: domain)
    }

    private let actionColumns = [
        GridItem(.adaptive(minimum: 158), spacing: 12),
    ]

    private var isExternalHosting: Bool {
        appState.activeServer?.isAgentManaged == true && appState.activeServer?.capabilities.domainHosting == true
    }

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    hero
                    if appState.clientOwnDomainsOnly {
                        clientBanner
                    }
                    infoCard
                    if appState.isAdmin && !isExternalHosting {
                        hostingToggleCard
                    }
                    moduleSection("Website", tiles: websiteTiles)
                    moduleSection("Email", tiles: emailTiles)
                    if !isExternalHosting {
                        moduleSection("Files & apps", tiles: filesTiles)
                        moduleSection("Security", tiles: securityTiles)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle(domain.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .top) {
            if let toggleError {
                ErrorBanner(message: toggleError)
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
            }
        }
        .task { await refreshDomain() }
        .preferredColorScheme(.dark)
    }

    private var websiteTiles: [ModuleTile] {
        if isExternalHosting {
            return [
                ModuleTile("DNS", "Records", "network", QadbakPalette.glow, AnyView(DnsRecordsView(domainName: domain.name))),
                ModuleTile("SSL", "Certificates", "lock.shield", QadbakPalette.success, AnyView(SslCertificatesView(domainName: domain.name))),
            ]
        }
        return [
            ModuleTile("Health", "Website", "heart.text.square", QadbakPalette.danger, AnyView(WebsiteHealthView(domainName: domain.name))),
            ModuleTile("Logs", "Live tail", "doc.text.magnifyingglass", .teal, AnyView(LiveLogsView(domainName: domain.name))),
            ModuleTile("DNS", "Records", "network", QadbakPalette.glow, AnyView(DnsRecordsView(domainName: domain.name))),
            ModuleTile("Redirects", "Paths", "arrow.right.circle", .orange, AnyView(RedirectsView(domainName: domain.name))),
            ModuleTile("Cron", "Scheduled", "clock.arrow.circlepath", .pink, AnyView(CronJobsView(domainName: domain.name))),
            ModuleTile("SSL", "Certificates", "lock.shield", QadbakPalette.success, AnyView(SslCertificatesView(domainName: domain.name))),
            ModuleTile("Backups", "Run now", "externaldrive", QadbakPalette.warning, AnyView(BackupsView(domainName: domain.name))),
        ]
    }

    private var emailTiles: [ModuleTile] {
        var tiles = [
            ModuleTile("Mail", "Accounts", "envelope", .cyan, AnyView(MailAccountsView(domainName: domain.name))),
            ModuleTile("Aliases", "Forward", "arrow.triangle.branch", .mint, AnyView(AliasesView(domainName: domain.name))),
        ]
        if appState.webmailEnabled {
            tiles.append(ModuleTile("Qmail", "Inbox", "envelope.open", .green, AnyView(MailAccountsView(domainName: domain.name, openWebmail: true))))
        }
        return tiles
    }

    private var filesTiles: [ModuleTile] {
        var tiles: [ModuleTile] = [
            ModuleTile("Databases", "MySQL", "cylinder.split.1x2", .blue, AnyView(DatabasesView(domainName: domain.name))),
            ModuleTile("Apps", "Install", "shippingbox", .purple, AnyView(DomainAppsView(domainName: domain.name))),
        ]
        if appState.filesEnabled {
            tiles.insert(ModuleTile("Files", "Browser", "folder", .orange, AnyView(FilesBrowserView(domainName: domain.name))), at: 0)
        }
        tiles.append(ModuleTile("FTP", "Accounts", "arrow.up.arrow.down.circle", .teal, AnyView(FtpAccountsView(domainName: domain.name))))
        return tiles
    }

    private var securityTiles: [ModuleTile] {
        [
            ModuleTile("Terminal", "Shell", "terminal", .indigo, AnyView(DomainTerminalView(domainName: domain.name))),
        ]
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(domain.name)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(QadbakPalette.text)
            if domain.disabled == true {
                Label("Hosting paused", systemImage: "pause.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.warning)
            } else {
                Text(isExternalHosting ? "Linked HestiaCP — DNS, mail, databases, and SSL." : "Same modules as the web panel — grouped for mobile.")
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private var clientBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.crop.circle.badge.checkmark")
            Text("Client account — you only see domains assigned to you.")
                .font(.caption)
        }
        .foregroundStyle(QadbakPalette.accent)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.glow.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var infoCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 10) {
                if appState.premiumActive, let premium = appState.premiumPlanLabel {
                    row("Qadbak license", premium)
                }
                if let plan = domain.plan, !plan.isEmpty {
                    row("Hosting plan", formatHostingPlan(plan))
                }
                if let user = domain.user, !user.isEmpty {
                    row("Unix user", user)
                }
                if let used = domain.diskUsed, let limit = domain.diskLimit {
                    row("Disk", "\(used) / \(limit)")
                }
            }
        }
    }

    @ViewBuilder
    private var hostingToggleCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Hosting status")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text(domain.disabled == true ? "This domain is paused on the server." : "Website and mail are active.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                QBSecondaryButton(
                    title: domain.disabled == true ? "Enable hosting" : "Pause hosting",
                    loading: isTogglingHosting
                ) {
                    Task { await toggleHosting() }
                }
            }
        }
    }

    private func moduleSection(_ title: String, tiles: [ModuleTile]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            QBSectionHeader(title: title)
            LazyVGrid(columns: actionColumns, spacing: 12) {
                ForEach(tiles) { tile in
                    NavigationLink(destination: tile.destination) {
                        QBActionTile(title: tile.title, subtitle: tile.subtitle, icon: tile.icon, tint: tile.tint)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func formatHostingPlan(_ plan: String) -> String {
        let trimmed = plan.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.lowercased() == "default" { return "Default" }
        return trimmed.prefix(1).uppercased() + trimmed.dropFirst()
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(QadbakPalette.muted)
            Spacer()
            Text(value)
                .foregroundStyle(QadbakPalette.text)
                .fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private func refreshDomain() async {
        guard let hosting = appState.hostingAPI else { return }
        do {
            let detail = try await hosting.domainDetail(domain.name)
            domain = detail.domain
        } catch {
            // Keep list-passed domain data on failure.
        }
    }

    private func toggleHosting() async {
        guard let api = appState.api else { return }
        isTogglingHosting = true
        toggleError = nil
        defer { isTogglingHosting = false }
        do {
            if domain.disabled == true {
                try await api.enableDomain(domain.name)
            } else {
                try await api.disableDomain(domain.name)
            }
            await refreshDomain()
        } catch {
            toggleError = error.localizedDescription
        }
    }
}

private struct ModuleTile: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let tint: Color
    let destination: AnyView

    init(_ title: String, _ subtitle: String, _ icon: String, _ tint: Color, _ destination: AnyView) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.tint = tint
        self.destination = destination
    }
}

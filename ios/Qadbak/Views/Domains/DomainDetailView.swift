import SwiftUI

struct DomainDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var domain: HostedDomain

    init(domain: HostedDomain) {
        _domain = State(initialValue: domain)
    }

    private let actionColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                hero
                if appState.clientOwnDomainsOnly {
                    clientBanner
                }
                infoCard
                Text("Manage")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(QadbakPalette.muted)
                    .textCase(.uppercase)
                    .tracking(0.8)
                LazyVGrid(columns: actionColumns, spacing: 12) {
                    actionLink(WebsiteHealthView(domainName: domain.name)) {
                        QBActionTile(title: "Health", subtitle: "Website", icon: "heart.text.square", tint: QadbakPalette.danger)
                    }
                    actionLink(LiveLogsView(domainName: domain.name)) {
                        QBActionTile(title: "Logs", subtitle: "Live tail", icon: "doc.text.magnifyingglass", tint: Color.teal)
                    }
                    actionLink(DnsRecordsView(domainName: domain.name)) {
                        QBActionTile(title: "DNS", subtitle: "Records", icon: "network", tint: QadbakPalette.glow)
                    }
                    actionLink(MailAccountsView(domainName: domain.name)) {
                        QBActionTile(title: "Mail", subtitle: "Accounts", icon: "envelope", tint: Color.cyan)
                    }
                    if appState.webmailEnabled {
                        actionLink(MailAccountsView(domainName: domain.name, openWebmail: true)) {
                            QBActionTile(
                                title: "Qmail",
                                subtitle: "Inbox",
                                icon: "envelope.open",
                                tint: Color.mint
                            )
                        }
                    }
                    if appState.filesEnabled {
                        actionLink(FilesBrowserView(domainName: domain.name)) {
                            QBActionTile(title: "Files", subtitle: "Browser", icon: "folder", tint: Color.orange)
                        }
                    }
                    actionLink(SslCertificatesView(domainName: domain.name)) {
                        QBActionTile(title: "SSL", subtitle: "Certificates", icon: "lock.shield", tint: QadbakPalette.success)
                    }
                    actionLink(BackupsView(domainName: domain.name)) {
                        QBActionTile(title: "Backups", subtitle: "Run now", icon: "externaldrive", tint: QadbakPalette.warning)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(QadbakPalette.bg)
        .navigationTitle(domain.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await refreshDomain() }
        .preferredColorScheme(.dark)
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
                Text("Tap a module below to manage this domain.")
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
                if let plan = domain.plan, !plan.isEmpty {
                    row("Plan", plan)
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

    private func actionLink<D: View, L: View>(_ destination: D, @ViewBuilder label: () -> L) -> some View {
        NavigationLink(destination: destination) {
            label()
        }
        .buttonStyle(.plain)
    }

    private func refreshDomain() async {
        guard let api = appState.api else { return }
        do {
            let detail = try await api.domainDetail(domain.name)
            domain = detail.domain
        } catch {
            // Keep list-passed domain data on failure.
        }
    }
}

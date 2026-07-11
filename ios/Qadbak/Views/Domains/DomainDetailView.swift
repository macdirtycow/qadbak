import SwiftUI

struct DomainDetailView: View {
    @Environment(AppState.self) private var appState
    let domain: HostedDomain

    var body: some View {
        List {
            if appState.clientOwnDomainsOnly {
                Section {
                    Label(
                        "Client account — only your assigned domains are shown.",
                        systemImage: "person.crop.circle.badge.checkmark"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }

            Section {
                LabeledContent("Domain", value: domain.name)
                if let plan = domain.plan, !plan.isEmpty {
                    LabeledContent("Plan", value: plan)
                }
                if let user = domain.user, !user.isEmpty {
                    LabeledContent("Unix user", value: user)
                }
                if let used = domain.diskUsed, let limit = domain.diskLimit {
                    LabeledContent("Disk", value: "\(used) / \(limit)")
                }
                if domain.disabled == true {
                    Label("Hosting disabled", systemImage: "pause.circle.fill")
                        .foregroundStyle(.orange)
                }
            }

            Section("Manage") {
                NavigationLink {
                    DnsRecordsView(domainName: domain.name)
                } label: {
                    Label("DNS records", systemImage: "network")
                }
                NavigationLink {
                    MailAccountsView(domainName: domain.name)
                } label: {
                    Label("Mail accounts", systemImage: "envelope")
                }
                if appState.webmailEnabled {
                    NavigationLink {
                        MailAccountsView(domainName: domain.name, openWebmail: true)
                    } label: {
                        Label("Webmail", systemImage: "envelope.open")
                    }
                }
                NavigationLink {
                    FilesBrowserView(domainName: domain.name)
                } label: {
                    Label("Files", systemImage: "folder")
                }
                NavigationLink {
                    SslCertificatesView(domainName: domain.name)
                } label: {
                    Label("SSL certificates", systemImage: "lock.shield")
                }
                NavigationLink {
                    BackupsView(domainName: domain.name)
                } label: {
                    Label("Backups", systemImage: "externaldrive")
                }
            }
        }
        .navigationTitle(domain.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

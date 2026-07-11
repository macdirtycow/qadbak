import SwiftUI

struct WebsiteHealthView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var report: WebsiteHealthReport?
    @State private var isLoading = false
    @State private var isRestarting = false
    @State private var restartOutput: String?
    @State private var errorMessage: String?

    private var canRestart: Bool {
        appState.role == "admin" && (report?.repairAvailable ?? true)
    }

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            Group {
                if isLoading && report == nil {
                    QBLoadingState(message: "Checking website…")
                } else if let errorMessage, report == nil {
                    VStack(spacing: 12) {
                        ErrorBanner(message: errorMessage)
                        QBEmptyState(title: "Health check failed", message: "Could not load website status.", icon: "heart.slash")
                    }
                    .padding(20)
                } else if let report {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if canRestart {
                                QBPrimaryButton(title: "Restart website", loading: isRestarting) {
                                    Task { await restartWebsite() }
                                }
                            }
                            probeCard("Public site", report.publicProbe)
                            probeCard("Origin (server)", report.localProbe)
                            if let stack = report.stack {
                                stackCard(stack)
                            }
                            if let validation = report.validation, let messages = validation.messages, !messages.isEmpty {
                                issuesCard("Validation", messages, tone: validation.valid == true ? QadbakPalette.success : QadbakPalette.warning)
                            }
                            if let cf = report.cloudflare, let issues = cf.issues, !issues.isEmpty {
                                issuesCard("Cloudflare", issues, tone: QadbakPalette.warning)
                            }
                            if let checklist = report.cloudflare?.dnsChecklist, !checklist.isEmpty {
                                issuesCard("DNS checklist", checklist, tone: QadbakPalette.muted)
                            }
                            if let restartOutput, !restartOutput.isEmpty {
                                logCard(restartOutput)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Website health")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    private func logCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Repair log")
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            Text(text)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(QadbakPalette.muted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func probeCard(_ title: String, _ probe: WebsiteProbe?) -> some View {
        let ok = probe?.ok == true
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Spacer()
                statusPill(ok ? "OK" : "Issue", color: ok ? QadbakPalette.success : QadbakPalette.danger)
            }
            if let status = probe?.status {
                Text("HTTP \(status)").font(.caption).foregroundStyle(QadbakPalette.muted)
            }
            if probe?.dnsPending == true {
                Label("DNS not propagated yet", systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.warning)
            }
            if probe?.cloudflare523 == true {
                Label("Cloudflare 523 — origin unreachable", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.danger)
            }
            if probe?.cloudflare502 == true {
                Label("Cloudflare 502 — bad gateway", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.danger)
            }
            if let error = probe?.error, !error.isEmpty {
                Text(error).font(.caption).foregroundStyle(QadbakPalette.muted)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func stackCard(_ stack: WebsiteStackHealth) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Stack")
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            if let ssl = stack.sslDaysLeft {
                row("SSL expires in", "\(ssl) days")
            }
            if let backup = stack.backupAgeDays {
                row("Last backup", "\(backup) days ago")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func issuesCard(_ title: String, _ items: [String], tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(tone).frame(width: 6, height: 6).padding(.top, 6)
                    Text(item).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(QadbakPalette.muted)
            Spacer()
            Text(value).foregroundStyle(QadbakPalette.text)
        }
        .font(.subheadline)
    }

    private func statusPill(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            report = try await api.websiteHealth(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func restartWebsite() async {
        guard let api = appState.api else { return }
        guard await BiometricGate.authenticate(reason: "Confirm restart website on \(domainName)") else {
            errorMessage = "Face ID required to restart the website."
            return
        }
        isRestarting = true
        errorMessage = nil
        LiveActivityManager.start(
            domain: domainName,
            kind: "repair",
            title: "Restarting website",
            detail: domainName
        )
        defer { isRestarting = false }
        do {
            LiveActivityManager.update(title: "Restarting website", detail: "Running repair on server…", progress: 0.45)
            let res = try await api.repairWebsite(domainName)
            restartOutput = res.output
            LiveActivityManager.update(title: "Restart complete", detail: domainName, progress: 0.95)
            LiveActivityManager.end(success: res.ok == true, message: "Website restart finished.")
            await load()
        } catch {
            errorMessage = error.localizedDescription
            LiveActivityManager.end(success: false, message: error.localizedDescription)
        }
    }
}

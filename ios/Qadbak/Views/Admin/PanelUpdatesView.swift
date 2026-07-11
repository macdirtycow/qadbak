import SwiftUI

struct PanelUpdatesView: View {
    @Environment(AppState.self) private var appState

    @State private var qadbakStatus: QadbakUpdateStatus?
    @State private var linuxStatus: LinuxUpdateStatus?
    @State private var updatesError: String?
    @State private var panelOutput: String?
    @State private var jobLog: String?
    @State private var activeJobId: String?
    @State private var activeJobStatus: String?
    @State private var isLoading = false
    @State private var isUpgrading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "Panel updates",
                        subtitle: "Upgrade Qadbak and manage panel processes."
                    )

                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    if let successMessage { SuccessBanner(message: successMessage) }

                    qadbakCard
                    linuxCard
                    panelControlCard

                    if let jobLog, !jobLog.isEmpty {
                        logCard("Upgrade log", jobLog)
                    }
                    if let panelOutput, !panelOutput.isEmpty {
                        logCard("Panel control", panelOutput)
                    }
                }
                .padding(20)
            }
            .refreshable { await reload() }
        }
        .navigationTitle("Updates")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .preferredColorScheme(.dark)
    }

    private var qadbakCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Qadbak panel", systemImage: "arrow.triangle.2.circlepath")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)

                if isLoading && qadbakStatus == nil {
                    ProgressView()
                } else if let err = updatesError {
                    Text(err).font(.caption).foregroundStyle(QadbakPalette.warning)
                } else if let status = qadbakStatus {
                    statusRow("Branch", status.branch ?? "—")
                    statusRow("Commit", shortCommit(status.commit))
                    if let behind = status.behind {
                        statusRow("Behind remote", behind == 0 ? "Up to date" : "\(behind) commit(s)")
                    } else if status.upToDate == true {
                        statusRow("Status", "Up to date")
                    }
                    if let message = status.message, !message.isEmpty {
                        Text(message).font(.caption).foregroundStyle(QadbakPalette.muted)
                    }
                }

                HStack(spacing: 10) {
                    Button("Refresh") { Task { await reload() } }
                        .buttonStyle(.bordered)
                        .tint(QadbakPalette.accent)
                    Button(isUpgrading ? "Upgrading…" : "Upgrade panel") {
                        Task { await upgradePanel() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(QadbakPalette.primary)
                    .disabled(isUpgrading)
                }
            }
        }
    }

    private var linuxCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Linux packages", systemImage: "shippingbox")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)

                if let linux = linuxStatus {
                    statusRow("Upgradable", "\(linux.upgradable ?? 0)")
                    statusRow("Security", "\(linux.security ?? 0)")
                    if linux.rebootRequired == true {
                        Text("Reboot required after upgrade.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.warning)
                    }
                    if let line = linux.summaryLine, !line.isEmpty {
                        Text(line).font(.caption).foregroundStyle(QadbakPalette.muted)
                    }
                } else {
                    Text("No package status loaded.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }

                Button("Upgrade packages") { Task { await upgradeLinux() } }
                    .buttonStyle(.borderedProminent)
                    .tint(QadbakPalette.warning)
                    .disabled(isUpgrading)
            }
        }
    }

    private var panelControlCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Panel processes", systemImage: "memorychip")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)

                HStack(spacing: 8) {
                    controlButton("Restart panel", action: "restart")
                    controlButton("Restart all", action: "restart-all")
                }
            }
        }
    }

    private func controlButton(_ title: String, action: String) -> some View {
        Button(title) { Task { await panelAction(action) } }
            .buttonStyle(.bordered)
            .tint(QadbakPalette.accent)
    }

    private func logCard(_ title: String, _ text: String) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(QadbakPalette.muted)
                ScrollView {
                    Text(text)
                        .font(.caption.monospaced())
                        .foregroundStyle(QadbakPalette.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
                .frame(maxHeight: 220)
            }
        }
    }

    private func statusRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(QadbakPalette.muted)
            Spacer()
            Text(value).foregroundStyle(QadbakPalette.text).fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private func shortCommit(_ commit: String?) -> String {
        guard let commit, !commit.isEmpty else { return "—" }
        return String(commit.prefix(8))
    }

    private func reload() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await api.qadbakUpdateStatus()
            updatesError = res.error
            qadbakStatus = res.qadbak
            let linux = try await api.linuxUpdateStatus()
            linuxStatus = linux.linux
            if let jobId = activeJobId {
                await pollJob(jobId)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func upgradePanel() async {
        guard let api = appState.api else { return }
        isUpgrading = true
        errorMessage = nil
        successMessage = nil
        defer { isUpgrading = false }
        do {
            let res = try await api.upgradeQadbakPanel()
            activeJobId = res.job?.id
            successMessage = "Panel upgrade started."
            if let jobId = res.job?.id {
                await pollJobUntilDone(jobId)
            }
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func upgradeLinux() async {
        guard let api = appState.api else { return }
        isUpgrading = true
        errorMessage = nil
        defer { isUpgrading = false }
        do {
            let res = try await api.upgradeLinuxPackages()
            if let jobId = res.job?.id {
                activeJobId = jobId
                await pollJobUntilDone(jobId)
            }
            successMessage = "Linux upgrade started."
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func panelAction(_ action: String) async {
        guard let api = appState.api else { return }
        errorMessage = nil
        do {
            let res = try await api.panelControlAction(action)
            panelOutput = res.output
            successMessage = "Action \(action) completed."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func pollJobUntilDone(_ jobId: String) async {
        for _ in 0..<120 {
            await pollJob(jobId)
            if activeJobStatus == "done" || activeJobStatus == "failed" { break }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }
    }

    private func pollJob(_ jobId: String) async {
        guard let api = appState.api else { return }
        do {
            let res = try await api.pollUpdateJob(jobId)
            jobLog = res.log
            activeJobStatus = res.job?.status
            if res.job?.status == "done" || res.job?.status == "failed" {
                activeJobId = nil
            }
        } catch {
            // Keep polling silently while job runs.
        }
    }
}

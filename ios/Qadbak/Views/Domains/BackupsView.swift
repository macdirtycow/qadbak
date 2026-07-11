import SwiftUI

struct BackupsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var scheduled: [ScheduledBackup] = []
    @State private var canBackup = true
    @State private var isLoading = false
    @State private var isStarting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    if let successMessage { SuccessBanner(message: successMessage) }
                    QBGlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("On-demand backup")
                                .font(.headline)
                                .foregroundStyle(QadbakPalette.text)
                            Text("Start a full backup of this domain now.")
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.muted)
                            QBPrimaryButton(title: "Run backup now", loading: isStarting, disabled: !canBackup) {
                                Task { await startBackup() }
                            }
                        }
                    }
                    Text("Scheduled")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(QadbakPalette.muted)
                        .textCase(.uppercase)
                    if isLoading && scheduled.isEmpty {
                        ProgressView().tint(QadbakPalette.accent)
                    } else if scheduled.isEmpty {
                        Text("No scheduled backups configured.")
                            .font(.subheadline)
                            .foregroundStyle(QadbakPalette.muted)
                    } else {
                        ForEach(scheduled) { backup in
                            backupCard(backup)
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Backups")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    private func backupCard(_ backup: ScheduledBackup) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(backup.id)
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Spacer()
                Text(backup.isEnabled ? "On" : "Off")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(backup.isEnabled ? QadbakPalette.success : QadbakPalette.muted)
            }
            if let schedule = backup.schedule {
                Text(schedule).font(.caption).foregroundStyle(QadbakPalette.muted)
            }
            if let dest = backup.dest {
                Text(dest).font(.caption2).foregroundStyle(QadbakPalette.muted.opacity(0.8))
            }
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await api.listBackups(domainName)
            scheduled = res.scheduled ?? []
            canBackup = res.canBackup ?? true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func startBackup() async {
        guard let api = appState.api else { return }
        isStarting = true
        errorMessage = nil
        successMessage = nil
        defer { isStarting = false }
        do {
            try await api.startBackup(domainName)
            successMessage = "Backup started."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

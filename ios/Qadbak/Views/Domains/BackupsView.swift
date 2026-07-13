import SwiftUI

struct BackupsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var scheduled: [ScheduledBackup] = []
    @State private var canBackup = true
    @State private var isLoading = false
    @State private var isStarting = false
    @State private var savingArchiveId: String?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var autoSaveToICloud = BackupICloudSettings.autoSaveAfterBackup
    @State private var wifiOnlyDownloads = BackupICloudSettings.wifiOnly

    private var scheduleRows: [ScheduledBackup] {
        scheduled.filter(\.isScheduleConfig)
    }

    private var archiveRows: [ScheduledBackup] {
        scheduled.filter(\.isArchive)
    }

    private var canDownloadToICloud: Bool {
        appState.api != nil
    }

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
                            Text("Start a full backup of this domain on your server.")
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.muted)
                            QBPrimaryButton(title: "Run backup now", loading: isStarting, disabled: !canBackup) {
                                Task { await startBackup() }
                            }
                        }
                    }

                    if canDownloadToICloud {
                        iCloudSection
                    }

                    if !scheduleRows.isEmpty {
                        sectionHeader("Schedule")
                        ForEach(scheduleRows) { backup in
                            scheduleCard(backup)
                        }
                    }

                    sectionHeader("Archives")
                    if isLoading && scheduled.isEmpty {
                        ProgressView().tint(QadbakPalette.accent)
                    } else if archiveRows.isEmpty {
                        Text("No backup archives yet. Run a backup first.")
                            .font(.subheadline)
                            .foregroundStyle(QadbakPalette.muted)
                    } else {
                        ForEach(archiveRows) { backup in
                            archiveCard(backup)
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

    private var iCloudSection: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("iCloud Drive", systemImage: "icloud.fill")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)

                if BackupICloudService.iCloudAvailable {
                    Text("Copies are saved under Files → iCloud Drive → Qadbak Backups.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                } else {
                    Text("Sign in to iCloud and enable iCloud Drive to save backups from this device.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.warning)
                }

                Toggle("Auto-save to iCloud after backup", isOn: $autoSaveToICloud)
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.text)
                    .disabled(!BackupICloudService.iCloudAvailable)
                    .onChange(of: autoSaveToICloud) { _, value in
                        BackupICloudSettings.autoSaveAfterBackup = value
                    }

                Toggle("Wi-Fi only (recommended)", isOn: $wifiOnlyDownloads)
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.text)
                    .onChange(of: wifiOnlyDownloads) { _, value in
                        BackupICloudSettings.wifiOnly = value
                    }
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.bold))
            .foregroundStyle(QadbakPalette.muted)
            .textCase(.uppercase)
    }

    private func scheduleCard(_ backup: ScheduledBackup) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Automatic")
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

    private func archiveCard(_ backup: ScheduledBackup) -> some View {
        let isSaving = savingArchiveId == backup.id
        return VStack(alignment: .leading, spacing: 10) {
            Text(backup.id)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(QadbakPalette.text)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            if let dest = backup.dest {
                Text(dest)
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
            if let kind = backup.schedule {
                Text(kind)
                    .font(.caption2)
                    .foregroundStyle(QadbakPalette.muted.opacity(0.85))
            }
            Button {
                Task { await saveArchiveToICloud(backup) }
            } label: {
                HStack(spacing: 8) {
                    if isSaving {
                        ProgressView()
                            .controlSize(.small)
                            .tint(QadbakPalette.primary)
                    } else {
                        Image(systemName: "icloud.and.arrow.up")
                    }
                    Text(isSaving ? "Downloading…" : "Save to iCloud")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(QadbakPalette.glow.opacity(0.35), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .foregroundStyle(QadbakPalette.primary)
            }
            .disabled(isSaving || !BackupICloudService.iCloudAvailable || !canDownloadToICloud)
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func load() async {
        guard let hosting = appState.hostingAPI else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let res = try await hosting.listBackups(domainName)
            scheduled = res.scheduled ?? []
            canBackup = res.canBackup ?? true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func startBackup() async {
        guard let hosting = appState.hostingAPI else { return }
        let existingArchives = Set(archiveRows.map(\.id))
        isStarting = true
        errorMessage = nil
        successMessage = nil
        LiveActivityManager.start(
            domain: domainName,
            kind: "backup",
            title: "Running backup",
            detail: domainName
        )
        defer { isStarting = false }
        do {
            LiveActivityManager.update(title: "Running backup", detail: "Backup in progress…", progress: 0.5)
            let createdFile = try await hosting.startBackup(domainName)
            await load()

            if canDownloadToICloud, autoSaveToICloud, BackupICloudService.iCloudAvailable {
                if let archiveName = createdFile ?? newestArchiveName(excluding: existingArchives) {
                    LiveActivityManager.update(title: "Saving to iCloud", detail: archiveName, progress: 0.75)
                    await saveArchiveByName(archiveName)
                    if errorMessage == nil {
                        successMessage = "Backup created and saved to iCloud Drive."
                        LiveActivityManager.end(success: true, message: "Backup saved to iCloud.")
                    }
                    return
                }
            }

            successMessage = "Backup created on server."
            LiveActivityManager.end(success: true, message: "Backup created on server.")
        } catch {
            errorMessage = error.localizedDescription
            LiveActivityManager.end(success: false, message: error.localizedDescription)
        }
    }

    private func saveArchiveToICloud(_ backup: ScheduledBackup) async {
        guard let archiveName = backup.archiveFileName else { return }
        await saveArchiveByName(archiveName, archiveId: backup.id)
    }

    private func saveArchiveByName(_ archiveName: String, archiveId: String? = nil) async {
        guard let api = appState.api, canDownloadToICloud else { return }
        let trackId = archiveId ?? archiveName
        savingArchiveId = trackId
        errorMessage = nil
        LiveActivityManager.start(
            domain: domainName,
            kind: "backup",
            title: "Saving to iCloud",
            detail: archiveName
        )
        defer { savingArchiveId = nil }
        do {
            let service = api.makeBackupICloudService()
            _ = try await service.downloadAndSaveToICloud(
                domain: domainName,
                archiveName: archiveName,
                wifiOnly: wifiOnlyDownloads
            )
            successMessage = "Saved to iCloud Drive → Qadbak Backups → \(domainName)."
            LiveActivityManager.end(success: true, message: "Backup saved to iCloud.")
        } catch {
            errorMessage = error.localizedDescription
            LiveActivityManager.end(success: false, message: error.localizedDescription)
        }
    }

    private func newestArchiveName(excluding existing: Set<String>) -> String? {
        archiveRows
            .filter { !existing.contains($0.id) }
            .map(\.id)
            .sorted(by: >)
            .first
    }
}

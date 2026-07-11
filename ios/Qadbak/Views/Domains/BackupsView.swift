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
        List {
            Section {
                Button {
                    Task { await startBackup() }
                } label: {
                    HStack {
                        Label("Run backup now", systemImage: "play.circle.fill")
                        Spacer()
                        if isStarting {
                            ProgressView()
                        }
                    }
                }
                .disabled(!canBackup || isStarting)
            } footer: {
                Text("Starts an on-demand backup for this domain.")
            }

            Section("Scheduled backups") {
                if scheduled.isEmpty {
                    Text("No scheduled backups configured.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(scheduled) { backup in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(backup.id)
                                    .font(.headline)
                                Spacer()
                                Text(backup.isEnabled ? "On" : "Off")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(backup.isEnabled ? .green : .secondary)
                            }
                            if let schedule = backup.schedule, !schedule.isEmpty {
                                Text(schedule)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            if let dest = backup.dest, !dest.isEmpty {
                                Text(dest)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Backups")
        .safeAreaInset(edge: .top) {
            VStack(spacing: 8) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }
                if let successMessage {
                    SuccessBanner(message: successMessage)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
        }
        .overlay {
            if isLoading && scheduled.isEmpty {
                ProgressView("Loading backups…")
            }
        }
        .refreshable { await load() }
        .task { await load() }
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

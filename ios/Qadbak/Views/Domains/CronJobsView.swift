import SwiftUI

struct CronJobsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var jobs: [CronJob] = []
    @State private var canEdit = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCreate = false
    @State private var jobToDelete: CronJob?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && jobs.isEmpty {
                    QBLoadingState(message: "Loading cron jobs…")
                } else if jobs.isEmpty {
                    QBEmptyState(
                        title: "No cron jobs",
                        message: canEdit
                            ? "Schedule commands with standard cron syntax."
                            : "No scheduled tasks for this domain.",
                        icon: "clock.arrow.circlepath"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(jobs) { job in
                                cronRow(job)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Cron")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .top) { banners }
        .toolbar {
            if canEdit {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreate = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                CreateCronJobView(domainName: domainName) {
                    showCreate = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete cron job?", isPresented: Binding(
            get: { jobToDelete != nil },
            set: { if !$0 { jobToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let job = jobToDelete {
                    Task { await delete(job) }
                }
            }
            Button("Cancel", role: .cancel) { jobToDelete = nil }
        } message: {
            if let job = jobToDelete {
                Text(job.command)
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var banners: some View {
        VStack(spacing: 8) {
            if !canEdit {
                infoBanner("View only — only administrators can edit cron jobs.")
            }
            if let errorMessage { ErrorBanner(message: errorMessage) }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private func infoBanner(_ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle")
            Text(text)
                .font(.caption)
        }
        .foregroundStyle(QadbakPalette.accent)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.glow.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private func cronRow(_ job: CronJob) -> some View {
        QBListRow(
            title: job.schedule,
            subtitle: jobSubtitle(job),
            icon: "clock.arrow.circlepath",
            tint: Color.pink
        ) {
            if canEdit {
                Button(role: .destructive) {
                    jobToDelete = job
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(QadbakPalette.danger)
                }
            }
        }
    }

    private func jobSubtitle(_ job: CronJob) -> String {
        var parts = [job.command]
        if let user = job.user, !user.isEmpty {
            parts.append("user: \(user)")
        }
        return parts.joined(separator: " · ")
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await api.listCronJobs(domainName)
            jobs = result.jobs
            canEdit = result.canEdit
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ job: CronJob) async {
        guard let api = appState.api else { return }
        jobToDelete = nil
        do {
            try await api.deleteCronJob(domainName, id: job.id)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CreateCronJobView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var schedule = "0 2 * * *"
    @State private var command = ""
    @State private var user = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "New cron job",
                        subtitle: "min hour day month weekday"
                    )
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Schedule", placeholder: "0 2 * * *", text: $schedule)
                            QBTextField(label: "Command", placeholder: "/usr/bin/php script.php", text: $command)
                            QBTextField(label: "User (optional)", placeholder: domainName, text: $user)
                        }
                    }
                    QBPrimaryButton(title: "Add cron job", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add cron")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !schedule.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        let trimmedUser = user.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await api.createCronJob(
                domainName,
                schedule: schedule.trimmingCharacters(in: .whitespacesAndNewlines),
                command: command.trimmingCharacters(in: .whitespacesAndNewlines),
                user: trimmedUser.isEmpty ? nil : trimmedUser
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

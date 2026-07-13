import SwiftUI

struct DatabasesView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var databases: [HostedDatabase] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showCreate = false
    @State private var databaseToDelete: HostedDatabase?
    @State private var databaseToChangePassword: HostedDatabase?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && databases.isEmpty {
                    QBLoadingState(message: "Loading databases…")
                } else if databases.isEmpty {
                    QBEmptyState(
                        title: "No databases",
                        message: "Create a MySQL database for apps like WordPress.",
                        icon: "cylinder.split.1x2"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(databases) { db in
                                QBListRow(
                                    title: db.dbName,
                                    subtitle: "\(db.dbType.uppercased()) · \(db.dbHost)",
                                    icon: "cylinder.split.1x2",
                                    tint: Color.blue
                                ) {
                                    Button {
                                        databaseToChangePassword = db
                                    } label: {
                                        Image(systemName: "key.fill")
                                            .foregroundStyle(QadbakPalette.accent)
                                    }
                                    Button(role: .destructive) {
                                        databaseToDelete = db
                                    } label: {
                                        Image(systemName: "trash")
                                            .foregroundStyle(QadbakPalette.danger)
                                    }
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Databases")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .top) { banners }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showCreate = true } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                CreateDatabaseView(domainName: domainName) {
                    showCreate = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete database?", isPresented: Binding(
            get: { databaseToDelete != nil },
            set: { if !$0 { databaseToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let db = databaseToDelete {
                    Task { await deleteDatabase(db) }
                }
            }
            Button("Cancel", role: .cancel) { databaseToDelete = nil }
        } message: {
            if let db = databaseToDelete {
                Text(db.dbName)
            }
        }
        .sheet(item: $databaseToChangePassword) { db in
            NavigationStack {
                ChangeDatabasePasswordView(domainName: domainName, database: db) {
                    databaseToChangePassword = nil
                }
            }
            .preferredColorScheme(.dark)
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var banners: some View {
        VStack(spacing: 8) {
            if let errorMessage { ErrorBanner(message: errorMessage) }
            if let successMessage { SuccessBanner(message: successMessage) }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private func load() async {
        guard let hosting = appState.hostingAPI else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            databases = try await hosting.listDatabases(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteDatabase(_ db: HostedDatabase) async {
        guard let hosting = appState.hostingAPI else { return }
        databaseToDelete = nil
        do {
            try await hosting.deleteDatabase(domainName, name: db.dbName)
            successMessage = "Database deleted."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ChangeDatabasePasswordView: View {
    let domainName: String
    let database: HostedDatabase
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "Change password", subtitle: database.dbName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        QBTextField(label: "New password", placeholder: "Strong password", text: $password, secure: true)
                    }
                    QBPrimaryButton(title: "Save password", loading: isSaving, disabled: password.count < 8) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Database password")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss(); onDone() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await hosting.updateDatabasePassword(domainName, name: database.dbName, pass: password)
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CreateDatabaseView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var password = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "New database", subtitle: domainName)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Database name", placeholder: "wp_app", text: $name)
                            QBTextField(label: "Password", placeholder: "Strong password", text: $password, secure: true)
                        }
                    }
                    QBPrimaryButton(title: "Create database", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add database")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && password.count >= 8
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await hosting.createDatabase(
                domainName,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                pass: password,
                type: "mysql"
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

import SwiftUI

struct DatabasesView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var databases: [HostedDatabase] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showCreate = false

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
                                )
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

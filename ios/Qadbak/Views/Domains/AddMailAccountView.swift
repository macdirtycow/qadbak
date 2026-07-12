import SwiftUI

struct AddMailAccountView: View {
    let domainName: String
    let onDone: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "New mailbox",
                        subtitle: "Creates \(usernamePreview)@\(domainName)"
                    )
                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }
                    QBGlassCard {
                        VStack(spacing: 16) {
                            QBTextField(label: "Username", placeholder: "info", text: $username, keyboard: .emailAddress)
                            QBTextField(label: "Password", placeholder: "Strong password", text: $password, secure: true)
                            QBTextField(label: "Display name (optional)", placeholder: "Support team", text: $displayName)
                        }
                    }
                    QBPrimaryButton(title: "Create mailbox", loading: isSaving, disabled: !canSave) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add mailbox")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var usernamePreview: String {
        let u = username.trimmingCharacters(in: .whitespacesAndNewlines)
        return u.isEmpty ? "user" : u
    }

    private var canSave: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && password.count >= 8
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
            let real = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            try await hosting.createMailUser(
                domainName,
                user: user,
                pass: password,
                real: real.isEmpty ? nil : real
            )
            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

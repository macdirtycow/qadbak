import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: "Settings", subtitle: "Account and app preferences")
                    QBGlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            settingsRow("Signed in as", appState.username ?? "—")
                            settingsRow("Role", appState.role?.capitalized ?? "—")
                            if let host = appState.serverURL?.host {
                                settingsRow("Server", host)
                            }
                            if let plan = appState.premiumPlanLabel {
                                settingsRow("License", plan)
                            }
                        }
                    }
                    QBGlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("Face ID / Touch ID lock", systemImage: "faceid")
                                .foregroundStyle(QadbakPalette.text)
                            Text("Configure in iOS Settings → Qadbak.")
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.muted)
                        }
                    }
                    QBSecondaryButton(title: "Close") {
                        dismiss()
                    }
                    Button(role: .destructive) {
                        Task { await appState.logout() }
                    } label: {
                        Text("Sign out")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .preferredColorScheme(.dark)
    }

    private func settingsRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(QadbakPalette.muted)
            Spacer()
            Text(value)
                .foregroundStyle(QadbakPalette.text)
                .fontWeight(.medium)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

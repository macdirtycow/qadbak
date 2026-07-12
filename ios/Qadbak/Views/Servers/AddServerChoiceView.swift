import SwiftUI

struct AddServerChoiceView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var showLinuxOnboarding = false

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    QBScreenHeader(
                        title: "Add server",
                        subtitle: "Connect a Qadbak panel or a Linux server with the Qadbak Agent."
                    )

                    betaBanner

                    VStack(spacing: 12) {
                        choiceCard(
                            title: "Qadbak server",
                            subtitle: "Existing panel with domains, mail, and hosting.",
                            icon: "server.rack",
                            tint: QadbakPalette.accent
                        ) {
                            Task {
                                await appState.prepareAddServer(mode: .qadbakPanel)
                                dismiss()
                            }
                        }

                        choiceCard(
                            title: "Linux server via SSH",
                            subtitle: "Install the lightweight Qadbak Agent (beta). Debian 12 & Ubuntu 22.04/24.04.",
                            icon: "terminal",
                            tint: .teal
                        ) {
                            showLinuxOnboarding = true
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add server")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .navigationDestination(isPresented: $showLinuxOnboarding) {
            LinuxServerOnboardingView()
        }
        .preferredColorScheme(.dark)
    }

    private var betaBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.shield")
            VStack(alignment: .leading, spacing: 4) {
                Text("Linux agent is in beta")
                    .font(.subheadline.weight(.semibold))
                Text("Use a test server first. The agent can reboot services and the host. Ensure backups exist.")
                    .font(.caption)
            }
        }
        .foregroundStyle(QadbakPalette.warning)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QadbakPalette.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func choiceCard(
        title: String,
        subtitle: String,
        icon: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            QBGlassCard {
                HStack(spacing: 14) {
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundStyle(tint)
                        .frame(width: 36)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.headline)
                            .foregroundStyle(QadbakPalette.text)
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

import SwiftUI

struct AgentUpgradeView: View {
    let server: ManagedServer
    let manifest: AgentReleaseManifest
    let currentVersion: String
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var username = "root"
    @State private var password = ""
    @State private var usePassword = true
    @State private var privateKeyPEM = ""
    @State private var keyPassphrase = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var progressMessage = ""

    private let ssh = SSHSessionService()

    var body: some View {
        NavigationStack {
            QBScreenContainer {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        QBScreenHeader(
                            title: "Upgrade agent",
                            subtitle: "Update from \(currentVersion) to \(manifest.version) via SSH."
                        )
                        if let errorMessage { ErrorBanner(message: errorMessage) }
                        if isBusy {
                            QBLoadingState(message: progressMessage)
                        } else {
                            authCard
                            QBGlassCard {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("What happens")
                                        .font(.headline)
                                        .foregroundStyle(QadbakPalette.text)
                                    Text("The verified binary from the app bundle replaces /usr/lib/qadbak-agent/qadbak-agent and restarts the service. Pairing tokens are unchanged.")
                                        .font(.caption)
                                        .foregroundStyle(QadbakPalette.muted)
                                }
                            }
                            QBPrimaryButton(title: "Upgrade now", loading: isBusy, disabled: !canUpgrade) {
                                Task { await runUpgrade() }
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Agent upgrade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .preferredColorScheme(.dark)
        }
    }

    private var authCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 16) {
                QBTextField(label: "SSH username", placeholder: "root", text: $username)
                Picker("Auth", selection: $usePassword) {
                    Text("Password").tag(true)
                    Text("SSH key").tag(false)
                }
                .pickerStyle(.segmented)
                if usePassword {
                    QBTextField(label: "Password (not stored)", placeholder: "••••••••", text: $password, secure: true)
                } else {
                    TextEditor(text: $privateKeyPEM)
                        .font(.caption.monospaced())
                        .frame(minHeight: 100)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .background(QadbakPalette.surface.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                    QBTextField(label: "Passphrase", placeholder: "Optional", text: $keyPassphrase, secure: true)
                }
            }
        }
    }

    private var canUpgrade: Bool {
        if usePassword { return !password.isEmpty && !username.isEmpty }
        return privateKeyPEM.contains("BEGIN OPENSSH PRIVATE KEY") && !username.isEmpty
    }

    private func sshSettings() -> SSHConnectionSettings {
        SSHConnectionSettings(
            host: server.ipAddress,
            port: 22,
            username: username.trimmingCharacters(in: .whitespacesAndNewlines),
            auth: usePassword ? .password(password) : .privateKeyPEM(privateKeyPEM, passphrase: keyPassphrase)
        )
    }

    private func runUpgrade() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            progressMessage = "Verifying bundled agent…"
            let arch = server.architecture ?? "x86_64"
            let verified = try AgentInstallService.verifiedBinary(architecture: arch)
            progressMessage = "Uploading via SSH…"
            let fingerprint = KeychainStore().loadSshHostKeyFingerprint(serverId: server.id)
            try await ssh.upgradeAgent(
                settings: sshSettings(),
                knownHostFingerprint: fingerprint,
                binary: verified.data,
                agentPort: server.agentPort ?? 9443
            )
            password = ""
            privateKeyPEM = ""
            onComplete()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

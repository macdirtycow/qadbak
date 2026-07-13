import SwiftUI

struct AgentUpgradeView: View {
    let server: ManagedServer
    let manifest: AgentReleaseManifest
    let currentVersion: String
    let client: AgentAPIClient
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var showSSHFallback = false
    @State private var username = ""
    @State private var password = ""
    @State private var usePassword = true
    @State private var privateKeyPEM = ""
    @State private var keyPassphrase = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var progressMessage = ""

    var body: some View {
        NavigationStack {
            QBScreenContainer {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        QBScreenHeader(
                            title: "Upgrade agent",
                            subtitle: "Update from \(currentVersion) to \(manifest.version)."
                        )
                        if let errorMessage { ErrorBanner(message: errorMessage) }
                        if isBusy {
                            QBLoadingState(message: progressMessage)
                        } else {
                            infoCard
                            if showSSHFallback {
                                sshAuthCard
                            }
                            QBPrimaryButton(
                                title: showSSHFallback ? "Upgrade via SSH" : "Upgrade now",
                                loading: isBusy,
                                disabled: showSSHFallback ? !canUpgradeSSH : false
                            ) {
                                Task { await runUpgrade() }
                            }
                            if !showSSHFallback {
                                Button("Use SSH instead") {
                                    showSSHFallback = true
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(QadbakPalette.muted)
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
            .onAppear {
                if username.isEmpty {
                    let saved = server.username?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    username = saved.isEmpty ? "root" : saved
                }
            }
            .task {
                if server.capabilities.agentSelfUpgrade { return }
                if let caps = try? await client.capabilities().capabilities?.toServerCapabilities(),
                   caps.agentSelfUpgrade {
                    return
                }
                showSSHFallback = true
            }
        }
    }

    private var infoCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(showSSHFallback ? "SSH upgrade" : "Secure upgrade")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text(showSSHFallback
                     ? "Uploads the verified binary from this app over SSH. Pairing tokens stay on the server."
                     : "Uploads the verified binary over your existing Tailscale / HTTPS connection. Face ID confirmation is required. Pairing tokens are unchanged.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private var sshAuthCard: some View {
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
                        .background(QadbakPalette.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                    QBTextField(label: "Passphrase", placeholder: "Optional", text: $keyPassphrase, secure: true)
                }
            }
        }
    }

    private var canUpgradeSSH: Bool {
        if usePassword { return !password.isEmpty && !username.isEmpty }
        return privateKeyPEM.contains("BEGIN OPENSSH PRIVATE KEY") && !username.isEmpty
    }

    private func sshSettings() -> SSHConnectionSettings? {
        guard canUpgradeSSH else { return nil }
        return SSHConnectionSettings(
            host: server.ipAddress ?? server.hostname,
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
            progressMessage = "Preparing upgrade…"
            let outcome = try await AgentUpgradeService.upgrade(
                server: server,
                client: client,
                manifest: manifest,
                currentVersion: currentVersion,
                sshSettings: showSSHFallback ? sshSettings() : nil,
                onProgress: { progressMessage = $0 }
            )
            password = ""
            privateKeyPEM = ""
            _ = outcome
            onComplete()
            dismiss()
        } catch {
            if !showSSHFallback {
                errorMessage = "\(error.localizedDescription) You can try SSH upgrade below."
                showSSHFallback = true
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }
}

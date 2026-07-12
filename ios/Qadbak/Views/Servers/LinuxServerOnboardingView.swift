import SwiftUI
import UIKit

struct LinuxServerOnboardingView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var step: AgentInstallStep = .connection
    @State private var displayName = ""
    @State private var host = ""
    @State private var port = "22"
    @State private var username = "root"
    @State private var password = ""
    @State private var usePassword = true
    @State private var privateKeyPEM = ""
    @State private var consentAccepted = false
    @State private var probe: SSHSystemProbe?
    @State private var progressMessage = ""
    @State private var errorMessage: String?
    @State private var isBusy = false
    @State private var agentPort = 9443

    private let ssh = SSHSessionService()

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: step.title, subtitle: "Step \(stepIndex + 1) of \(AgentInstallStep.allCases.count)")
                    stepIndicator
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    stepContent
                    navigationButtons
                }
                .padding(20)
            }
        }
        .navigationTitle("Linux server")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }

    private var stepIndex: Int {
        AgentInstallStep.allCases.firstIndex(of: step) ?? 0
    }

    private var stepIndicator: some View {
        HStack(spacing: 6) {
            ForEach(Array(AgentInstallStep.allCases.enumerated()), id: \.offset) { idx, _ in
                Capsule()
                    .fill(idx <= stepIndex ? QadbakPalette.accent : QadbakPalette.border)
                    .frame(height: 4)
            }
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .connection:
            QBGlassCard {
                VStack(spacing: 16) {
                    QBTextField(label: "Display name", placeholder: "Production VPS", text: $displayName)
                    QBTextField(label: "Host", placeholder: "203.0.113.10", text: $host, keyboard: .URL)
                    QBTextField(label: "SSH port", placeholder: "22", text: $port, keyboard: .numberPad)
                    QBTextField(label: "SSH username", placeholder: "root", text: $username)
                }
            }
        case .authentication:
            QBGlassCard {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Method", selection: $usePassword) {
                        Text("Password").tag(true)
                        Text("SSH private key").tag(false)
                    }
                    .pickerStyle(.segmented)
                    if usePassword {
                        QBTextField(label: "Password (not stored)", placeholder: "••••••••", text: $password, secure: true)
                        Text("Password is kept in memory only during setup.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    } else {
                        Text("SSH key authentication will be available in a future update. Use password for now.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.warning)
                    }
                }
            }
        case .detection:
            if isBusy {
                QBLoadingState(message: progressMessage.isEmpty ? "Detecting system…" : progressMessage)
            } else if let probe {
                detectionCard(probe)
            } else {
                Text("Tap Continue to run read-only detection over SSH.")
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.muted)
            }
        case .consent:
            QBGlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("The following will be installed:")
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)
                    Label("qadbak-agent binary (~7 MB)", systemImage: "shippingbox")
                    Label("systemd service on port \(agentPort)", systemImage: "gearshape.2")
                    Label("Self-signed TLS certificate (you will pin the fingerprint)", systemImage: "lock.shield")
                    Text("Nothing changes on Hestia, Coolify, Plesk, or other panels.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                    Toggle(isOn: $consentAccepted) {
                        Text("I understand and want to proceed")
                            .foregroundStyle(QadbakPalette.text)
                    }
                    .tint(QadbakPalette.accent)
                }
                .font(.subheadline)
                .foregroundStyle(QadbakPalette.muted)
            }
        case .installAndPair:
            if isBusy {
                VStack(alignment: .leading, spacing: 12) {
                    QBLoadingState(message: progressMessage)
                    Text("Do not close the app during installation.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.warning)
                }
            } else {
                Text("Ready to install the agent and pair this device.")
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private func detectionCard(_ probe: SSHSystemProbe) -> some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 10) {
                row("OS", probe.operatingSystem)
                row("Architecture", probe.architecture)
                row("Hostname", probe.hostname)
                row("sudo (non-interactive)", probe.hasSudo ? "Yes" : "No — required")
                if let kind = probe.panelDetection.detectedPanel {
                    row("Panel", kind.displayName)
                }
                if !probe.hasSudo {
                    ErrorBanner(message: "Passwordless sudo is required for agent installation.")
                }
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(QadbakPalette.muted)
            Spacer()
            Text(value).foregroundStyle(QadbakPalette.text).fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private var navigationButtons: some View {
        VStack(spacing: 12) {
            if step != .installAndPair {
                QBPrimaryButton(title: "Continue", loading: isBusy, disabled: !canContinue) {
                    Task { await advance() }
                }
            } else {
                QBPrimaryButton(title: "Install & pair", loading: isBusy, disabled: !canContinue) {
                    Task { await installAndPair() }
                }
            }
            if step != .connection {
                QBSecondaryButton(title: "Back") {
                    errorMessage = nil
                    if let idx = AgentInstallStep.allCases.firstIndex(of: step), idx > 0 {
                        step = AgentInstallStep.allCases[idx - 1]
                    }
                }
            }
        }
    }

    private var canContinue: Bool {
        switch step {
        case .connection:
            return !displayName.trimmingCharacters(in: .whitespaces).isEmpty
                && !host.trimmingCharacters(in: .whitespaces).isEmpty
                && Int(port) != nil
                && !username.trimmingCharacters(in: .whitespaces).isEmpty
        case .authentication:
            if usePassword { return password.count >= 1 }
            return false
        case .detection:
            return probe?.hasSudo == true
        case .consent:
            return consentAccepted
        case .installAndPair:
            return true
        }
    }

    private func sshSettings() -> SSHConnectionSettings {
        SSHConnectionSettings(
            host: host.trimmingCharacters(in: .whitespacesAndNewlines),
            port: Int(port) ?? 22,
            username: username.trimmingCharacters(in: .whitespacesAndNewlines),
            auth: usePassword ? .password(password) : .privateKeyPEM(privateKeyPEM)
        )
    }

    private func advance() async {
        errorMessage = nil
        switch step {
        case .connection:
            step = .authentication
        case .authentication:
            step = .detection
            await runDetection()
        case .detection:
            step = .consent
        case .consent:
            step = .installAndPair
        case .installAndPair:
            break
        }
    }

    private func runDetection() async {
        isBusy = true
        progressMessage = "Connecting via SSH…"
        defer { isBusy = false }
        do {
            probe = try await ssh.probeSystem(settings: sshSettings(), knownHostFingerprint: nil)
            password = ""
        } catch {
            errorMessage = error.localizedDescription
            step = .authentication
        }
    }

    private func installAndPair() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        guard let probe else { return }

        do {
            progressMessage = "Uploading agent binary…"
            let binary = try AgentInstallService.loadAgentBinary(architecture: probe.architecture)
            let settings = sshSettings()
            let result = try await ssh.uploadAndInstall(
                settings: settings,
                knownHostFingerprint: nil,
                binary: binary,
                agentPort: agentPort
            )

            progressMessage = "Pairing with agent…"
            let baseURL = AgentInstallService.makeAgentBaseURL(host: settings.host, port: agentPort)
            let deviceId = UIDeviceIdentifier.persistentUUID

            var pairedAccess = ""
            var pairedRefresh = ""

            let client = AgentAPIClient(
                baseURL: baseURL,
                pinnedFingerprint: result.tlsFingerprint,
                refreshTokenProvider: { pairedRefresh },
                onTokensRefreshed: { access, refresh in
                    pairedAccess = access
                    pairedRefresh = refresh
                }
            )

            let pairRes = try await client.pairingComplete(
                pairingToken: result.pairingToken,
                deviceId: deviceId,
                deviceLabel: UIDevice.current.name
            )
            guard pairRes.ok != false,
                  let access = pairRes.accessToken,
                  let refresh = pairRes.refreshToken else {
                throw APIError.message(pairRes.error ?? "Pairing failed.")
            }
            pairedAccess = access
            pairedRefresh = refresh

            let serverKind = pairRes.panelDetection?.detectedPanel.flatMap { ServerKind(rawValue: $0) }
                ?? probe.panelDetection.detectedPanel
                ?? .genericLinux

            var server = ManagedServer.linuxAgentPending(
                displayName: displayName.trimmingCharacters(in: .whitespaces),
                hostname: probe.hostname,
                ipAddress: settings.host,
                agentPort: agentPort
            )
            server.serverKind = serverKind
            server.operatingSystem = probe.operatingSystem
            server.architecture = probe.architecture
            server.authenticationMethod = .agentToken
            server.connectionStatus = .online
            server.lastSeen = Date()
            server.panelDetection = pairRes.panelDetection?.toPanelDetection() ?? probe.panelDetection
            server.capabilities = pairRes.capabilities?.toServerCapabilities() ?? .agentPlaceholder
            server.capabilities.systemMetrics = true

            try await appState.registerAgentServer(
                server,
                accessToken: pairedAccess,
                refreshToken: pairedRefresh,
                tlsFingerprint: result.tlsFingerprint
            )

            password = ""
            privateKeyPEM = ""
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

enum UIDeviceIdentifier {
    static var persistentUUID: String {
        let key = "qadbak.deviceId"
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: key)
        return id
    }
}

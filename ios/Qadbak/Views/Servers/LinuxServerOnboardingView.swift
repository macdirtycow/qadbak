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
    @State private var keyPassphrase = ""
    @State private var consentAccepted = false
    @State private var probe: SSHSystemProbe?
    @State private var progressMessage = ""
    @State private var errorMessage: String?
    @State private var isBusy = false
    @State private var agentPort = 9443
    @State private var sshHostKeyFingerprint: String?
    @State private var installManifest: AgentReleaseManifest?
    @State private var listenMode: AgentListenMode = .tailscale

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
                        Text("Paste an OpenSSH private key (Ed25519 or RSA). The key is not stored on this device.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                        TextEditor(text: $privateKeyPEM)
                            .font(.caption.monospaced())
                            .frame(minHeight: 120)
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .background(QadbakPalette.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                        QBTextField(label: "Passphrase (if encrypted)", placeholder: "Optional", text: $keyPassphrase, secure: true)
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
                    Label("qadbak-agent v\(installManifest?.version ?? "…") (~7 MB)", systemImage: "shippingbox")
                    Label("Non-root systemd service on port \(agentPort)", systemImage: "gearshape.2")
                    Label("SHA-256 verified install manifest", systemImage: "checkmark.shield")
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
            networkAccessCard
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

    private var networkAccessCard: some View {
        QBGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("How should your phone reach the agent?")
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text("The agent no longer opens 0.0.0.0 by default. Pick an exposure mode before port \(agentPort) is reachable.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                ForEach(AgentListenMode.allCases) { mode in
                    Button {
                        listenMode = mode
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: listenMode == mode ? "largecircle.fill.circle" : "circle")
                                .foregroundStyle(listenMode == mode ? QadbakPalette.accent : QadbakPalette.muted)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(mode.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(QadbakPalette.text)
                                Text(mode.detail)
                                    .font(.caption)
                                    .foregroundStyle(QadbakPalette.muted)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                }
                if listenMode == .tailscale, probe?.tailscaleIPv4 == nil {
                    Text("Tailscale was not detected on this server. Install Tailscale first or choose Private LAN.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.warning)
                }
                if listenMode == .lan {
                    Text("This exposes the agent on every network interface. Prefer Tailscale when possible.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.warning)
                }
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
                if let ts = probe.tailscaleIPv4 {
                    row("Tailscale", ts)
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
            return privateKeyPEM.trimmingCharacters(in: .whitespacesAndNewlines).contains("BEGIN OPENSSH PRIVATE KEY")
        case .detection:
            return probe?.hasSudo == true
        case .consent:
            if listenMode == .tailscale && probe?.tailscaleIPv4 == nil {
                return false
            }
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
            auth: usePassword ? .password(password) : .privateKeyPEM(privateKeyPEM, passphrase: keyPassphrase)
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
            installManifest = try? AgentInstallService.loadManifest()
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
            let detection = try await ssh.probeSystem(settings: sshSettings(), knownHostFingerprint: sshHostKeyFingerprint)
            probe = detection.probe
            if detection.probe.tailscaleIPv4 != nil {
                listenMode = .tailscale
            } else {
                listenMode = .lan
            }
            if sshHostKeyFingerprint == nil {
                sshHostKeyFingerprint = detection.hostKeyFingerprint
            }
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
            progressMessage = "Verifying agent binary…"
            let verified = try AgentInstallService.verifiedBinary(architecture: probe.architecture)
            installManifest = verified.manifest
            let settings = sshSettings()
            let result = try await ssh.uploadAndInstall(
                settings: settings,
                knownHostFingerprint: sshHostKeyFingerprint,
                binary: verified.data,
                agentPort: agentPort,
                listenMode: listenMode
            )
            if sshHostKeyFingerprint == nil {
                sshHostKeyFingerprint = result.hostKeyFingerprint
            }

            progressMessage = "Pairing with agent…"
            let baseURL = AgentInstallService.makeAgentBaseURL(host: result.agentHost, port: agentPort)
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

            progressMessage = "Checking compatibility…"
            let versionInfo = try await client.version()
            if let agentVersion = versionInfo.version {
                try AgentCompatibility.ensureAgentMeetsRequirement(agentVersion, minimum: versionInfo.minAgentVersion)
            }
            try AgentCompatibility.ensureAppMeetsRequirement(versionInfo.minAppVersion)

            let serverKind = pairRes.panelDetection?.detectedPanel.flatMap { ServerKind(rawValue: $0) }
                ?? probe.panelDetection.detectedPanel
                ?? .genericLinux

            var server = ManagedServer.linuxAgentPending(
                displayName: displayName.trimmingCharacters(in: .whitespaces),
                hostname: probe.hostname,
                ipAddress: result.agentHost,
                agentPort: agentPort
            )
            server.apiBaseURL = baseURL.absoluteString
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
                tlsFingerprint: result.tlsFingerprint,
                sshHostKeyFingerprint: sshHostKeyFingerprint
            )

            password = ""
            privateKeyPEM = ""
            keyPassphrase = ""
            dismiss()
        } catch {
            if listenMode == .lan {
                errorMessage = "\(error.localizedDescription)\n\nLAN tip: open TCP 9443 on the VPS firewall (ufw + Contabo panel) and retry."
            } else {
                errorMessage = error.localizedDescription
            }
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

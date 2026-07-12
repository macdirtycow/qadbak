import SwiftUI
import UIKit

/// Pair with an agent that is already installed (no SSH install step).
struct LinuxAgentPairExistingView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var step: PairStep = .connection
    @State private var displayName = ""
    @State private var host = ""
    @State private var agentPort = "9443"
    @State private var tlsConfirmed = false
    @State private var pairingToken = ""
    @State private var tlsFingerprint = ""
    @State private var errorMessage: String?
    @State private var isBusy = false

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(title: step.title, subtitle: step.subtitle)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    stepContent
                    navigationButtons
                }
                .padding(20)
            }
        }
        .navigationTitle("Pair existing agent")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .connection:
            QBGlassCard {
                VStack(spacing: 16) {
                    QBTextField(label: "Display name", placeholder: "Production VPS", text: $displayName)
                    QBTextField(label: "Host", placeholder: "203.0.113.10", text: $host, keyboard: .URL)
                    QBTextField(label: "Agent port", placeholder: "9443", text: $agentPort, keyboard: .numberPad)
                }
            }
        case .tlsConfirm:
            QBGlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Verify TLS fingerprint")
                        .font(.headline)
                        .foregroundStyle(QadbakPalette.text)
                    Text("Confirm this SHA-256 fingerprint matches what you expect for this server.")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                    Text(tlsFingerprint)
                        .font(.caption.monospaced())
                        .foregroundStyle(QadbakPalette.accent)
                        .textSelection(.enabled)
                    Toggle(isOn: $tlsConfirmed) {
                        Text("I trust this fingerprint")
                            .foregroundStyle(QadbakPalette.text)
                    }
                    .tint(QadbakPalette.accent)
                }
            }
        case .pairing:
            if isBusy {
                QBLoadingState(message: "Completing pairing…")
            } else {
                Text("Ready to register this device with the agent.")
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private var navigationButtons: some View {
        VStack(spacing: 12) {
            if step != .pairing || !isBusy {
                QBPrimaryButton(title: primaryButtonTitle, loading: isBusy, disabled: !canContinue) {
                    Task { await advance() }
                }
            }
            if step != .connection {
                QBSecondaryButton(title: "Back") {
                    errorMessage = nil
                    step = step == .pairing ? .tlsConfirm : .connection
                }
            }
        }
    }

    private var primaryButtonTitle: String {
        switch step {
        case .connection: return "Connect"
        case .tlsConfirm: return "Continue"
        case .pairing: return "Pair device"
        }
    }

    private var canContinue: Bool {
        switch step {
        case .connection:
            return !displayName.trimmingCharacters(in: .whitespaces).isEmpty
                && !host.trimmingCharacters(in: .whitespaces).isEmpty
                && Int(agentPort) != nil
        case .tlsConfirm:
            return tlsConfirmed && !tlsFingerprint.isEmpty
        case .pairing:
            return !pairingToken.isEmpty
        }
    }

    private func advance() async {
        errorMessage = nil
        switch step {
        case .connection:
            await fetchPairingInit()
        case .tlsConfirm:
            step = .pairing
        case .pairing:
            await completePairing()
        }
    }

    private func fetchPairingInit() async {
        isBusy = true
        defer { isBusy = false }
        guard let port = Int(agentPort) else { return }
        let baseURL = AgentInstallService.makeAgentBaseURL(
            host: host.trimmingCharacters(in: .whitespacesAndNewlines),
            port: port
        )
        let client = AgentAPIClient(
            baseURL: baseURL,
            pinnedFingerprint: nil,
            refreshTokenProvider: { nil },
            onTokensRefreshed: { _, _ in }
        )
        do {
            let res = try await client.pairingInit()
            guard let token = res.pairingToken, let fp = res.tlsFingerprintSha256, !token.isEmpty, !fp.isEmpty else {
                throw APIError.message(res.error ?? "Agent did not return pairing credentials.")
            }
            pairingToken = token
            tlsFingerprint = fp
            step = .tlsConfirm
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func completePairing() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        guard let port = Int(agentPort) else { return }
        let hostTrimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
        let baseURL = AgentInstallService.makeAgentBaseURL(host: hostTrimmed, port: port)
        let deviceId = UIDeviceIdentifier.persistentUUID
        var pairedAccess = ""
        var pairedRefresh = ""

        let client = AgentAPIClient(
            baseURL: baseURL,
            pinnedFingerprint: tlsFingerprint,
            refreshTokenProvider: { pairedRefresh },
            onTokensRefreshed: { access, refresh in
                pairedAccess = access
                pairedRefresh = refresh
            }
        )

        do {
            let pairRes = try await client.pairingComplete(
                pairingToken: pairingToken,
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

            let versionInfo = try await client.version()
            if let agentVersion = versionInfo.version {
                try AgentCompatibility.ensureAgentMeetsRequirement(agentVersion, minimum: versionInfo.minAgentVersion)
            }
            try AgentCompatibility.ensureAppMeetsRequirement(versionInfo.minAppVersion)

            let serverKind = pairRes.panelDetection?.detectedPanel.flatMap { ServerKind(rawValue: $0) }
                ?? .genericLinux

            var server = ManagedServer.linuxAgentPending(
                displayName: displayName.trimmingCharacters(in: .whitespaces),
                hostname: hostTrimmed,
                ipAddress: hostTrimmed,
                agentPort: port
            )
            server.serverKind = serverKind
            server.authenticationMethod = .agentToken
            server.connectionStatus = .online
            server.lastSeen = Date()
            server.panelDetection = pairRes.panelDetection?.toPanelDetection()
            server.capabilities = pairRes.capabilities?.toServerCapabilities() ?? .agentPlaceholder
            server.capabilities.systemMetrics = true

            try await appState.registerAgentServer(
                server,
                accessToken: pairedAccess,
                refreshToken: pairedRefresh,
                tlsFingerprint: tlsFingerprint
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private enum PairStep {
        case connection
        case tlsConfirm
        case pairing

        var title: String {
            switch self {
            case .connection: return "Agent connection"
            case .tlsConfirm: return "Trust certificate"
            case .pairing: return "Pair device"
            }
        }

        var subtitle: String {
            switch self {
            case .connection: return "Connect to an agent that is already running on this host."
            case .tlsConfirm: return "Pin the agent TLS certificate before saving tokens."
            case .pairing: return "Register this iPhone with the agent."
            }
        }
    }
}

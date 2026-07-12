import Foundation

#if canImport(Citadel)
import Citadel
#endif

enum SSHServiceError: LocalizedError {
    case unavailable
    case invalidHost
    case commandFailed(String)
    case unsupportedOS(String)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "SSH requires the Citadel package. Add it via Xcode → Package Dependencies → orlangos-nl/Citadel."
        case .invalidHost:
            return "Invalid SSH host or port."
        case .commandFailed(let msg):
            return msg
        case .unsupportedOS(let msg):
            return msg
        }
    }
}

struct SSHSessionService {
    func run(_ command: String, settings: SSHConnectionSettings, knownHostFingerprint: String?) async throws -> String {
        #if canImport(Citadel)
        return try await runCitadel(command, settings: settings)
        #else
        throw SSHServiceError.unavailable
        #endif
    }

    func probeSystem(settings: SSHConnectionSettings, knownHostFingerprint: String?) async throws -> SSHSystemProbe {
        let arch = try await run("uname -m", settings: settings, knownHostFingerprint: knownHostFingerprint)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let osRelease = try await run("cat /etc/os-release", settings: settings, knownHostFingerprint: knownHostFingerprint)
        let hostname = try await run("hostname", settings: settings, knownHostFingerprint: knownHostFingerprint)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let sudoCheck = try await run("sudo -n true 2>/dev/null && echo ok || echo no", settings: settings, knownHostFingerprint: knownHostFingerprint)

        var osID = ""
        var versionID = ""
        var pretty = ""
        for line in osRelease.split(separator: "\n") {
            let s = String(line)
            if s.hasPrefix("ID=") { osID = stripQuotes(s.dropFirst(3)) }
            if s.hasPrefix("VERSION_ID=") { versionID = stripQuotes(s.dropFirst(11)) }
            if s.hasPrefix("PRETTY_NAME=") { pretty = stripQuotes(s.dropFirst(12)) }
        }

        try validateSupportedOS(id: osID, versionID: versionID)

        let panel = detectPanel(from: try await run(
            "[ -d /opt/qadbak ] && echo qadbak; [ -d /usr/local/hestia ] && echo hestia; [ -d /data/coolify ] && echo coolify; [ -d /usr/local/psa ] && echo plesk; [ -d /usr/local/directadmin ] && echo directadmin; true",
            settings: settings,
            knownHostFingerprint: knownHostFingerprint
        ))

        return SSHSystemProbe(
            architecture: arch,
            operatingSystem: pretty.isEmpty ? "\(osID) \(versionID)" : pretty,
            osID: osID,
            osVersionID: versionID,
            hasSudo: sudoCheck.contains("ok"),
            panelDetection: panel,
            hostname: hostname
        )
    }

    func uploadAndInstall(
        settings: SSHConnectionSettings,
        knownHostFingerprint: String?,
        binary: Data,
        agentPort: Int
    ) async throws -> (pairingToken: String, tlsFingerprint: String) {
        let remoteBin = "/tmp/qadbak-agent-\(UUID().uuidString)"
        let b64 = binary.base64EncodedString()
        let chunkSize = 32_000
        var offset = b64.startIndex
        var first = true
        while offset < b64.endIndex {
            let end = b64.index(offset, offsetBy: chunkSize, limitedBy: b64.endIndex) ?? b64.endIndex
            let chunk = String(b64[offset..<end])
            let op = first ? ">" : ">>"
            first = false
            _ = try await run(
                "printf '%s' '\(chunk)' | base64 -d \(op) '\(remoteBin)'",
                settings: settings,
                knownHostFingerprint: knownHostFingerprint
            )
            offset = end
        }

        _ = try await run("chmod +x '\(remoteBin)'", settings: settings, knownHostFingerprint: knownHostFingerprint)

        let installOutput = try await run(
            "sudo QADBAK_AGENT_PORT=\(agentPort) bash -s -- '\(remoteBin)' << 'QADBAK_INSTALL'\n" + embeddedInstallScript + "\nQADBAK_INSTALL",
            settings: settings,
            knownHostFingerprint: knownHostFingerprint
        )

        var pairing = ""
        var fingerprint = ""
        for line in installOutput.split(separator: "\n") {
            let s = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
            if s.hasPrefix("pairing:") { pairing = String(s.dropFirst(8)) }
            if s.hasPrefix("fingerprint:") { fingerprint = String(s.dropFirst(12)) }
        }
        if pairing.isEmpty {
            throw SSHServiceError.commandFailed("Install did not return pairing token.")
        }
        return (pairing, fingerprint)
    }

    private func validateSupportedOS(id: String, versionID: String) throws {
        switch id {
        case "debian" where versionID == "12": return
        case "ubuntu" where versionID == "22.04" || versionID == "24.04": return
        default:
            throw SSHServiceError.unsupportedOS("Beta supports Debian 12 and Ubuntu 22.04/24.04 only.")
        }
    }

    private func detectPanel(from output: String) -> PanelDetection {
        let lines = output.lowercased()
        let mapping: [(String, ServerKind)] = [
            ("qadbak", .qadbakPanel),
            ("hestia", .hestiaCP),
            ("coolify", .coolify),
            ("plesk", .plesk),
            ("directadmin", .directAdmin),
        ]
        for (token, kind) in mapping where lines.contains(token) {
            return PanelDetection(detectedPanel: kind, confidence: "medium", signals: [token], detectedAt: Date())
        }
        return PanelDetection(detectedPanel: .genericLinux, confidence: "low", signals: ["ssh-probe"], detectedAt: Date())
    }

    private func stripQuotes(_ value: Substring) -> String {
        String(value).trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
    }

    #if canImport(Citadel)
    private func runCitadel(_ command: String, settings: SSHConnectionSettings) async throws -> String {
        guard !settings.host.isEmpty, settings.port > 0, settings.port <= 65535 else {
            throw SSHServiceError.invalidHost
        }

        let authMethod: SSHAuthenticationMethod = {
            switch settings.auth {
            case .password(let pass):
                return .passwordBased(username: settings.username, password: pass)
            case .privateKeyPEM:
                return .passwordBased(username: settings.username, password: "")
            }
        }()

        let clientSettings = SSHClientSettings(
            host: settings.host,
            port: settings.port,
            authenticationMethod: { authMethod },
            hostKeyValidator: .acceptAnything()
        )

        let client = try await SSHClient.connect(to: clientSettings)
        defer { try? await client.close() }
        let buffer = try await client.executeCommand(command, mergeStreams: true)
        return String(buffer: buffer)
    }
    #endif

    private var embeddedInstallScript: String {
        """
        set -euo pipefail
        AGENT_PORT="${QADBAK_AGENT_PORT:-9443}"
        DATA_DIR="/var/lib/qadbak-agent"
        BIN_SRC="$1"
        install -d -m 0750 "$DATA_DIR"
        install -m 0755 "$BIN_SRC" /usr/local/bin/qadbak-agent
        cat >/etc/systemd/system/qadbak-agent.service <<EOF
        [Unit]
        Description=Qadbak Linux Agent
        After=network-online.target
        [Service]
        Type=simple
        Environment=QADBAK_AGENT_DATA_DIR=$DATA_DIR
        ExecStart=/usr/local/bin/qadbak-agent -listen 0.0.0.0:${AGENT_PORT} -data-dir $DATA_DIR
        Restart=on-failure
        [Install]
        WantedBy=multi-user.target
        EOF
        systemctl daemon-reload
        systemctl enable --now qadbak-agent.service
        sleep 1
        RESP=$(curl -sk -X POST "https://127.0.0.1:${AGENT_PORT}/api/v1/pairing/init")
        TOKEN=$(printf '%s' "$RESP" | sed -n 's/.*"pairingToken":"\\([^"]*\\)".*/\\1/p')
        FP=$(printf '%s' "$RESP" | sed -n 's/.*"tlsFingerprintSha256":"\\([^"]*\\)".*/\\1/p')
        echo "pairing:$TOKEN"
        echo "fingerprint:$FP"
        rm -f "$BIN_SRC"
        """
    }
}

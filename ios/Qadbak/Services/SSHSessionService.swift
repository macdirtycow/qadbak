import Foundation

#if canImport(Citadel)
import Citadel
import CryptoKit
import NIOCore
import NIOSSH
#endif

enum SSHServiceError: LocalizedError {
    case unavailable
    case invalidHost
    case hostKeyMismatch
    case commandFailed(String)
    case unsupportedOS(String)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "SSH requires the Citadel package. Add it via Xcode → Package Dependencies → orlangos-nl/Citadel."
        case .invalidHost:
            return "Invalid SSH host or port."
        case .hostKeyMismatch:
            return "SSH host key changed. Verify the server before reconnecting."
        case .commandFailed(let msg):
            return msg
        case .unsupportedOS(let msg):
            return msg
        }
    }
}

struct SSHCommandResult: Sendable {
    var output: String
    var hostKeyFingerprint: String?
}

struct SSHSessionService {
    func run(_ command: String, settings: SSHConnectionSettings, knownHostFingerprint: String?) async throws -> SSHCommandResult {
        #if canImport(Citadel)
        return try await runCitadel(command, settings: settings, knownHostFingerprint: knownHostFingerprint)
        #else
        throw SSHServiceError.unavailable
        #endif
    }

    func probeSystem(settings: SSHConnectionSettings, knownHostFingerprint: String?) async throws -> (probe: SSHSystemProbe, hostKeyFingerprint: String?) {
        let arch = try await run("uname -m", settings: settings, knownHostFingerprint: knownHostFingerprint)
        let osRelease = try await run("cat /etc/os-release", settings: settings, knownHostFingerprint: knownHostFingerprint)
        let hostname = try await run("hostname", settings: settings, knownHostFingerprint: knownHostFingerprint)
        let sudoCheck = try await run("sudo -n true 2>/dev/null && echo ok || echo no", settings: settings, knownHostFingerprint: knownHostFingerprint)

        var osID = ""
        var versionID = ""
        var pretty = ""
        for line in osRelease.output.split(separator: "\n") {
            let s = String(line)
            if s.hasPrefix("ID=") { osID = stripQuotes(s.dropFirst(3)) }
            if s.hasPrefix("VERSION_ID=") { versionID = stripQuotes(s.dropFirst(11)) }
            if s.hasPrefix("PRETTY_NAME=") { pretty = stripQuotes(s.dropFirst(12)) }
        }

        try validateSupportedOS(id: osID, versionID: versionID)

        let panel = detectPanel(from: try await run(
            "[ -d /opt/qadbak ] && echo qadbak; [ -d /usr/local/hestia ] && echo hestia; [ -d /data/coolify ] && echo coolify; [ -d /var/lib/casaos ] && echo casaos; [ -d /usr/local/psa ] && echo plesk; [ -d /usr/local/directadmin ] && echo directadmin; true",
            settings: settings,
            knownHostFingerprint: knownHostFingerprint
        ).output)

        let probe = SSHSystemProbe(
            architecture: arch.output.trimmingCharacters(in: .whitespacesAndNewlines),
            operatingSystem: pretty.isEmpty ? "\(osID) \(versionID)" : pretty,
            osID: osID,
            osVersionID: versionID,
            hasSudo: sudoCheck.output.contains("ok"),
            panelDetection: panel,
            hostname: hostname.output.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        return (probe, arch.hostKeyFingerprint ?? osRelease.hostKeyFingerprint ?? hostname.hostKeyFingerprint)
    }

    func uploadAndInstall(
        settings: SSHConnectionSettings,
        knownHostFingerprint: String?,
        binary: Data,
        agentPort: Int
    ) async throws -> (pairingToken: String, tlsFingerprint: String, hostKeyFingerprint: String?) {
        let remoteBin = "/tmp/qadbak-agent-\(UUID().uuidString)"
        let b64 = binary.base64EncodedString()
        let chunkSize = 32_000
        var offset = b64.startIndex
        var first = true
        var lastHostKey: String?
        while offset < b64.endIndex {
            let end = b64.index(offset, offsetBy: chunkSize, limitedBy: b64.endIndex) ?? b64.endIndex
            let chunk = String(b64[offset..<end])
            let op = first ? ">" : ">>"
            first = false
            let res = try await run(
                "printf '%s' '\(chunk)' | base64 -d \(op) '\(remoteBin)'",
                settings: settings,
                knownHostFingerprint: knownHostFingerprint
            )
            lastHostKey = res.hostKeyFingerprint ?? lastHostKey
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
        for line in installOutput.output.split(separator: "\n") {
            let s = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
            if s.hasPrefix("pairing:") { pairing = String(s.dropFirst(8)) }
            if s.hasPrefix("fingerprint:") { fingerprint = String(s.dropFirst(12)) }
        }
        if pairing.isEmpty {
            throw SSHServiceError.commandFailed("Install did not return pairing token.")
        }
        return (pairing, fingerprint, installOutput.hostKeyFingerprint ?? lastHostKey)
    }

    func upgradeAgent(
        settings: SSHConnectionSettings,
        knownHostFingerprint: String?,
        binary: Data,
        agentPort: Int
    ) async throws {
        let remoteBin = "/tmp/qadbak-agent-upgrade-\(UUID().uuidString)"
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
        _ = try await run(
            "sudo QADBAK_AGENT_PORT=\(agentPort) bash -s -- '\(remoteBin)' << 'QADBAK_UPGRADE'\n" + embeddedUpgradeScript + "\nQADBAK_UPGRADE",
            settings: settings,
            knownHostFingerprint: knownHostFingerprint
        )
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
            ("casaos", .casaOS),
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
    private func runCitadel(_ command: String, settings: SSHConnectionSettings, knownHostFingerprint: String?) async throws -> SSHCommandResult {
        guard !settings.host.isEmpty, settings.port > 0, settings.port <= 65535 else {
            throw SSHServiceError.invalidHost
        }

        let authMethod: SSHAuthenticationMethod = {
            switch settings.auth {
            case .password(let pass):
                return .passwordBased(username: settings.username, password: pass)
            case .privateKeyPEM(let pem, let passphrase):
                do {
                    return try SSHPrivateKeyAuth.authenticationMethod(
                        username: settings.username,
                        privateKeyPEM: pem,
                        passphrase: passphrase
                    )
                } catch {
                    return .passwordBased(username: settings.username, password: "")
                }
            }
        }()

        let pinDelegate = SSHHostKeyPinDelegate(expectedFingerprint: knownHostFingerprint)
        let clientSettings = SSHClientSettings(
            host: settings.host,
            port: settings.port,
            authenticationMethod: { authMethod },
            hostKeyValidator: .custom(pinDelegate)
        )

        let client = try await SSHClient.connect(to: clientSettings)
        defer { try? await client.close() }
        let buffer = try await client.executeCommand(command, mergeStreams: true)
        return SSHCommandResult(output: String(buffer: buffer), hostKeyFingerprint: pinDelegate.discoveredFingerprint)
    }
    #endif

    private var embeddedInstallScript: String {
        """
        set -euo pipefail
        AGENT_PORT="${QADBAK_AGENT_PORT:-9443}"
        DATA_DIR="/var/lib/qadbak-agent"
        CONFIG_DIR="/etc/qadbak-agent"
        INSTALL_DIR="/usr/lib/qadbak-agent"
        AGENT_USER="qadbak-agent"
        BIN_SRC="$1"
        if ! id "$AGENT_USER" &>/dev/null; then
          useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$AGENT_USER"
        fi
        usermod -aG adm "$AGENT_USER" 2>/dev/null || true
        if getent group docker &>/dev/null; then usermod -aG docker "$AGENT_USER" 2>/dev/null || true; fi
        install -d -m 0750 "$INSTALL_DIR" "$DATA_DIR" "$CONFIG_DIR"
        install -m 0755 "$BIN_SRC" "${INSTALL_DIR}/qadbak-agent"
        ln -sf "${INSTALL_DIR}/qadbak-agent" /usr/local/bin/qadbak-agent
        if [[ ! -f "${CONFIG_DIR}/jwt.secret" ]]; then
          openssl rand -hex 32 >"${CONFIG_DIR}/jwt.secret"
          chmod 640 "${CONFIG_DIR}/jwt.secret"
          chown root:"$AGENT_USER" "${CONFIG_DIR}/jwt.secret"
        fi
        cat >/etc/sudoers.d/qadbak-agent <<EOF
        Defaults:qadbak-agent !requiretty
        qadbak-agent ALL=(root) NOPASSWD: ${INSTALL_DIR}/qadbak-agent priv *
        EOF
        chmod 440 /etc/sudoers.d/qadbak-agent
        visudo -cf /etc/sudoers.d/qadbak-agent >/dev/null
        cat >/etc/systemd/system/qadbak-agent.service <<EOF
        [Unit]
        Description=Qadbak Linux Agent
        After=network-online.target
        Wants=network-online.target
        [Service]
        Type=simple
        User=${AGENT_USER}
        Group=${AGENT_USER}
        Environment=QADBAK_AGENT_DATA_DIR=${DATA_DIR}
        Environment=QADBAK_AGENT_LISTEN=0.0.0.0:${AGENT_PORT}
        Environment=QADBAK_AGENT_BINARY=${INSTALL_DIR}/qadbak-agent
        ExecStart=${INSTALL_DIR}/qadbak-agent -listen 0.0.0.0:${AGENT_PORT} -data-dir ${DATA_DIR}
        Restart=on-failure
        RestartSec=3
        NoNewPrivileges=true
        ProtectSystem=strict
        ProtectHome=true
        ReadWritePaths=${DATA_DIR} ${CONFIG_DIR}
        AmbientCapabilities=CAP_NET_BIND_SERVICE
        [Install]
        WantedBy=multi-user.target
        EOF
        chown -R "${AGENT_USER}:${AGENT_USER}" "$DATA_DIR"
        chmod 750 "$DATA_DIR"
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

    private var embeddedUpgradeScript: String {
        """
        set -euo pipefail
        INSTALL_DIR="/usr/lib/qadbak-agent"
        BIN_SRC="$1"
        install -d -m 0750 "$INSTALL_DIR"
        systemctl stop qadbak-agent.service || true
        install -m 0755 "$BIN_SRC" "${INSTALL_DIR}/qadbak-agent"
        ln -sf "${INSTALL_DIR}/qadbak-agent" /usr/local/bin/qadbak-agent
        systemctl daemon-reload
        systemctl start qadbak-agent.service
        rm -f "$BIN_SRC"
        echo "upgrade:ok"
        """
    }
}

#if canImport(Citadel)
private final class SSHHostKeyPinDelegate: @unchecked Sendable, NIOSSHClientServerAuthenticationDelegate {
    let expectedFingerprint: String?
    private(set) var discoveredFingerprint: String?

    init(expectedFingerprint: String?) {
        self.expectedFingerprint = expectedFingerprint?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func validateHostKey(hostKey: NIOSSHPublicKey, validationCompletePromise: EventLoopPromise<Void>) {
        let fingerprint = SSHHostKeyFingerprint.openSSHSHA256(hostKey)
        discoveredFingerprint = fingerprint
        if let expected = expectedFingerprint, !expected.isEmpty {
            if fingerprint.caseInsensitiveCompare(expected) == .orderedSame {
                validationCompletePromise.succeed(())
            } else {
                validationCompletePromise.fail(SSHServiceError.hostKeyMismatch)
            }
        } else {
            validationCompletePromise.succeed(())
        }
    }
}

private enum SSHHostKeyFingerprint {
    static func openSSHSHA256(_ hostKey: NIOSSHPublicKey) -> String {
        let openSSH = String(openSSHPublicKey: hostKey)
        let parts = openSSH.split(separator: " ", maxSplits: 1)
        guard parts.count == 2, let raw = Data(base64Encoded: String(parts[1])) else {
            return ""
        }
        let digest = SHA256.hash(data: raw)
        let encoded = Data(digest).base64EncodedString().replacingOccurrences(of: "=", with: "")
        return "SHA256:\(encoded)"
    }
}
#endif

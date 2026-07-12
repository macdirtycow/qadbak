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
    case connectionFailed(String)
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
        case .connectionFailed(let msg):
            return msg
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

        let tailscale = try await run("(command -v tailscale >/dev/null && tailscale ip -4 2>/dev/null | head -1) || true", settings: settings, knownHostFingerprint: knownHostFingerprint)
        let ts = tailscale.output.trimmingCharacters(in: .whitespacesAndNewlines)
        let tailscaleIP = ts.isEmpty ? nil : ts

        let probe = SSHSystemProbe(
            architecture: arch.output.trimmingCharacters(in: .whitespacesAndNewlines),
            operatingSystem: pretty.isEmpty ? "\(osID) \(versionID)" : pretty,
            osID: osID,
            osVersionID: versionID,
            hasSudo: sudoCheck.output.contains("ok"),
            panelDetection: panel,
            hostname: hostname.output.trimmingCharacters(in: .whitespacesAndNewlines),
            tailscaleIPv4: tailscaleIP
        )
        return (probe, arch.hostKeyFingerprint ?? osRelease.hostKeyFingerprint ?? hostname.hostKeyFingerprint)
    }

    func uploadAndInstall(
        settings: SSHConnectionSettings,
        knownHostFingerprint: String?,
        binary: Data,
        agentPort: Int,
        listenMode: AgentListenMode
    ) async throws -> (pairingToken: String, tlsFingerprint: String, hostKeyFingerprint: String?, agentHost: String) {
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
            "sudo QADBAK_AGENT_PORT=\(agentPort) QADBAK_AGENT_LISTEN_MODE=\(listenMode.rawValue) bash -s -- '\(remoteBin)' << 'QADBAK_INSTALL'\n" + embeddedInstallScript + "\nQADBAK_INSTALL",
            settings: settings,
            knownHostFingerprint: knownHostFingerprint
        )

        var pairing = ""
        var fingerprint = ""
        var agentHost = settings.host
        for line in installOutput.output.split(separator: "\n") {
            let s = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
            if s.hasPrefix("pairing:") { pairing = String(s.dropFirst(8)) }
            if s.hasPrefix("fingerprint:") { fingerprint = String(s.dropFirst(12)) }
            if s.hasPrefix("agent_listen_host:") {
                let host = String(s.dropFirst(18)).trimmingCharacters(in: .whitespaces)
                if !host.isEmpty, host != "0.0.0.0" { agentHost = host }
            }
        }
        if pairing.isEmpty {
            throw SSHServiceError.commandFailed("Install did not return pairing token.")
        }
        return (pairing, fingerprint, installOutput.hostKeyFingerprint ?? lastHostKey, agentHost)
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

    private func mapSSHConnectError(_ error: Error, host: String, port: Int) -> SSHServiceError {
        let text = String(describing: error).lowercased()
        let posix = (error as NSError).domain == NSPOSIXErrorDomain ? (error as NSError).code : 0
        if text.contains("authentication") || text.contains("auth fail") {
            return .connectionFailed("SSH login failed for \(host). Check username and password.")
        }
        if posix == 61 || text.contains("refused") || text.contains("nio connectionerror error 1") {
            return .connectionFailed(
                "Could not connect to \(host):\(port). Check the IP, port 22, firewall, and try Wi-Fi (some mobile networks block SSH)."
            )
        }
        if posix == 60 || text.contains("timed out") || text.contains("timeout") {
            return .connectionFailed(
                "SSH timed out reaching \(host):\(port). Confirm the server is online and port 22 is open."
            )
        }
        if posix == 64 || text.contains("unreachable") {
            return .connectionFailed("Network unreachable. Connect your phone to Wi-Fi and retry.")
        }
        return .connectionFailed("SSH connection failed (\(error.localizedDescription)). Host: \(host), port: \(port).")
    }

    static func normalizeSSHHost(_ raw: String) -> String {
        var host = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if host.hasPrefix("ssh://") {
            host = String(host.dropFirst(6))
        }
        if host.contains("@") {
            host = String(host.split(separator: "@", maxSplits: 1).last ?? Substring(host))
        }
        if host.hasPrefix("[") , host.contains("]") {
            host = String(host.dropFirst().prefix(while: { $0 != "]" }))
        } else if host.contains(":") {
            host = String(host.split(separator: ":", maxSplits: 1).first ?? Substring(host))
        }
        if host.hasPrefix("http://") || host.hasPrefix("https://") {
            if let url = URL(string: host), let h = url.host { host = h }
        }
        return host.trimmingCharacters(in: .whitespacesAndNewlines)
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

        let client: SSHClient
        do {
            client = try await SSHClient.connect(to: clientSettings)
        } catch {
            throw mapSSHConnectError(error, host: settings.host, port: settings.port)
        }
        defer { try? await client.close() }
        let buffer: ByteBuffer
        do {
            buffer = try await client.executeCommand(command, mergeStreams: true)
        } catch let error as SSHClient.CommandFailed {
            let hint: String
            switch error.exitCode {
            case 6:
                hint = "Port 9443 is already used by another process. On the server run: ss -tlnp | grep 9443 — stop that service or pick another port, then retry."
            case 7:
                hint = "The agent did not respond on port 9443 after install (curl could not connect). On the server run: systemctl status qadbak-agent; journalctl -u qadbak-agent -n 30; ss -tlnp | grep 9443. Ensure port 9443 is free, then retry."
            case 1:
                hint = "Install script failed. On the server run: systemctl stop qadbak-agent; rm -f /tmp/qadbak-agent-* /etc/sudoers.d/qadbak-agent; systemctl daemon-reload; then retry."
            default:
                hint = "If this was during install, run on the server: systemctl stop qadbak-agent; rm -f /tmp/qadbak-agent-*; then retry."
            }
            throw SSHServiceError.commandFailed("Remote command failed (exit \(error.exitCode)). \(hint)")
        }
        return SSHCommandResult(output: String(buffer: buffer), hostKeyFingerprint: pinDelegate.discoveredFingerprint)
    }
    #endif

    private var embeddedInstallScript: String {
        """
        set -euo pipefail
        AGENT_PORT="${QADBAK_AGENT_PORT:-9443}"
        LISTEN_MODE="${QADBAK_AGENT_LISTEN_MODE:-auto}"
        DATA_DIR="/var/lib/qadbak-agent"
        CONFIG_DIR="/etc/qadbak-agent"
        INSTALL_DIR="/usr/lib/qadbak-agent"
        AGENT_USER="qadbak-agent"
        BIN_SRC="$1"
        resolve_listen() {
          if [[ -n "${QADBAK_AGENT_LISTEN:-}" ]]; then printf '%s\\n' "$QADBAK_AGENT_LISTEN"; return; fi
          case "$LISTEN_MODE" in
            lan) printf '0.0.0.0:%s\\n' "$AGENT_PORT"; return ;;
            local|localhost) printf '127.0.0.1:%s\\n' "$AGENT_PORT"; return ;;
            tailscale)
              if command -v tailscale >/dev/null; then
                TS="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
                if [[ -n "$TS" ]]; then printf '%s:%s\\n' "$TS" "$AGENT_PORT"; return; fi
              fi
              echo "Tailscale not available; falling back to 127.0.0.1" >&2
              printf '127.0.0.1:%s\\n' "$AGENT_PORT"; return ;;
            auto|*)
              if command -v tailscale >/dev/null; then
                TS="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
                if [[ -n "$TS" ]]; then printf '%s:%s\\n' "$TS" "$AGENT_PORT"; return; fi
              fi
              printf '127.0.0.1:%s\\n' "$AGENT_PORT" ;;
          esac
        }
        apply_firewall() {
          command -v ufw >/dev/null 2>&1 || return 0
          ufw status >/dev/null 2>&1 || return 0
          case "$LISTEN_MODE" in
            tailscale|auto) ufw allow in on tailscale0 to any port "$AGENT_PORT" proto tcp comment 'qadbak-agent' >/dev/null 2>&1 || true ;;
            lan) ufw allow "$AGENT_PORT"/tcp comment 'qadbak-agent' >/dev/null 2>&1 || true ;;
          esac
        }
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
        printf '%s\\n' \\
          'Defaults:qadbak-agent !requiretty' \\
          "qadbak-agent ALL=(root) NOPASSWD: ${INSTALL_DIR}/qadbak-agent priv *" \\
          >/etc/sudoers.d/qadbak-agent
        chmod 440 /etc/sudoers.d/qadbak-agent
        visudo -cf /etc/sudoers.d/qadbak-agent >/dev/null
        AGENT_LISTEN="$(resolve_listen)"
        apply_firewall
        printf '%s\\n' "QADBAK_AGENT_LISTEN=${AGENT_LISTEN}" "QADBAK_AGENT_LISTEN_MODE=${LISTEN_MODE}" >"${CONFIG_DIR}/agent.env"
        chmod 640 "${CONFIG_DIR}/agent.env"
        printf '%s\\n' \\
          '[Unit]' \\
          'Description=Qadbak Linux Agent' \\
          'After=network-online.target' \\
          'Wants=network-online.target' \\
          '' \\
          '[Service]' \\
          'Type=simple' \\
          "User=${AGENT_USER}" \\
          "Group=${AGENT_USER}" \\
          "Environment=QADBAK_AGENT_DATA_DIR=${DATA_DIR}" \\
          "Environment=QADBAK_AGENT_LISTEN=${AGENT_LISTEN}" \\
          "Environment=QADBAK_AGENT_LISTEN_MODE=${LISTEN_MODE}" \\
          "Environment=QADBAK_AGENT_BINARY=${INSTALL_DIR}/qadbak-agent" \\
          "EnvironmentFile=-${CONFIG_DIR}/agent.env" \\
          "ExecStart=${INSTALL_DIR}/qadbak-agent -listen ${AGENT_LISTEN} -data-dir ${DATA_DIR}" \\
          'Restart=on-failure' \\
          'RestartSec=3' \\
          'NoNewPrivileges=true' \\
          'ProtectSystem=strict' \\
          'ProtectHome=true' \\
          "ReadWritePaths=${DATA_DIR} ${CONFIG_DIR}" \\
          'AmbientCapabilities=CAP_NET_BIND_SERVICE' \\
          '' \\
          '[Install]' \\
          'WantedBy=multi-user.target' \\
          >/etc/systemd/system/qadbak-agent.service
        chown -R "${AGENT_USER}:${AGENT_USER}" "$DATA_DIR"
        chmod 750 "$DATA_DIR"
        chown root:"$AGENT_USER" "${CONFIG_DIR}/agent.env" 2>/dev/null || true
        systemctl stop qadbak-agent.service 2>/dev/null || true
        if command -v ss >/dev/null 2>&1; then
          if ss -tlnH 2>/dev/null | awk -v p=":$AGENT_PORT" '$4 ~ p"$" {found=1} END{exit !found}'; then
            occupier="$(ss -tlnpH 2>/dev/null | awk -v p=":$AGENT_PORT" '$4 ~ p"$" {print; exit}')"
            echo "Port ${AGENT_PORT} is already in use: ${occupier:-unknown}" >&2
            exit 6
          fi
        fi
        systemctl daemon-reload
        systemctl enable qadbak-agent.service
        systemctl restart qadbak-agent.service
        LISTEN_HOST="${AGENT_LISTEN%%:*}"
        [[ "$LISTEN_HOST" == "0.0.0.0" ]] && CURL_HOST="127.0.0.1" || CURL_HOST="$LISTEN_HOST"
        AGENT_PUBLIC_HOST="$LISTEN_HOST"
        if [[ "$LISTEN_HOST" == "0.0.0.0" ]]; then
          AGENT_PUBLIC_HOST="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null | tr -d '[:space:]')"
          if [[ -z "$AGENT_PUBLIC_HOST" ]]; then
            AGENT_PUBLIC_HOST="$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '[:space:]')"
          fi
          [[ -z "$AGENT_PUBLIC_HOST" ]] && AGENT_PUBLIC_HOST="127.0.0.1"
        fi
        echo "agent_listen_host:$AGENT_PUBLIC_HOST"
        pairing_curl_host() {
          local host="${1:-}"
          [[ -z "$host" || "$host" == "0.0.0.0" ]] && return 1
          curl -4sk --max-time 8 -X POST "https://${host}:${AGENT_PORT}/api/v1/pairing/init"
        }
        RESP=""
        for _attempt in $(seq 1 45); do
          if systemctl is-active --quiet qadbak-agent.service; then
            for _host in 127.0.0.1 "$CURL_HOST"; do
              if RESP="$(pairing_curl_host "$_host" 2>/dev/null)" && [[ -n "$RESP" ]] && [[ "$RESP" == *pairingToken* ]]; then
                break 2
              fi
            done
          fi
          sleep 1
        done
        if [[ -z "$RESP" || "$RESP" != *pairingToken* ]]; then
          echo "qadbak-agent did not respond on port ${AGENT_PORT} (listen=${AGENT_LISTEN})" >&2
          systemctl status qadbak-agent.service --no-pager >&2 || true
          journalctl -u qadbak-agent.service -n 25 --no-pager >&2 || true
          exit 7
        fi
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

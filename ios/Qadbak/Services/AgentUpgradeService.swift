import Foundation

@MainActor
enum AgentUpgradeService {
    enum Method {
        case https
        case ssh
    }

    struct Outcome {
        let method: Method
        let newVersion: String
    }

    /// Upgrade using the paired HTTPS API when `sshSettings` is nil, otherwise SSH.
    static func upgrade(
        server: ManagedServer,
        client: AgentAPIClient,
        manifest: AgentReleaseManifest,
        currentVersion: String,
        sshSettings: SSHConnectionSettings?,
        onProgress: ((String) -> Void)? = nil
    ) async throws -> Outcome {
        let arch = server.architecture ?? "x86_64"
        let verified = try AgentInstallService.verifiedBinary(architecture: arch)
        let expectedSHA = verified.manifest.binaries[verified.architectureKey]?.sha256.lowercased() ?? ""

        if sshSettings == nil {
            onProgress?("Uploading agent via secure connection…")
            do {
                try await client.upgradeAgent(
                    binary: verified.data,
                    version: manifest.version,
                    sha256: expectedSHA
                )
            } catch let error as APIError {
                if case .http(let code, _) = error, code == 404 || code == 405 {
                    throw APIError.message("This agent version does not support in-app upgrade yet. Use SSH.")
                }
                if !isRestartDisconnect(error) {
                    throw error
                }
            } catch {
                if !isRestartDisconnect(error) {
                    throw error
                }
            }
            onProgress?("Waiting for agent to restart…")
            let onlineVersion = try await waitForAgentVersion(
                client: client,
                expected: manifest.version,
                timeout: 120
            )
            return Outcome(method: .https, newVersion: onlineVersion)
        }

        onProgress?("Uploading via SSH…")
        let fingerprint = KeychainStore().loadSshHostKeyFingerprint(serverId: server.id)
        try await SSHSessionService().upgradeAgent(
            settings: sshSettings!,
            knownHostFingerprint: fingerprint,
            binary: verified.data,
            agentPort: server.agentPort ?? 9443
        )
        onProgress?("Waiting for agent to restart…")
        let onlineVersion = try await waitForAgentVersion(
            client: client,
            expected: manifest.version,
            timeout: 120
        )
        return Outcome(method: .ssh, newVersion: onlineVersion)
    }

    static func waitForAgentVersion(
        client: AgentAPIClient,
        expected: String,
        timeout: TimeInterval = 120
    ) async throws -> String {
        let deadline = Date().addingTimeInterval(timeout)
        var lastError: Error?
        while Date() < deadline {
            do {
                try await Task.sleep(nanoseconds: 2_000_000_000)
                let res = try await client.version()
                if let version = res.version, !version.isEmpty {
                    if AgentCompatibility.isAtLeast(version, required: expected) {
                        return version
                    }
                    return version
                }
            } catch {
                lastError = error
            }
        }
        if let lastError {
            throw lastError
        }
        throw APIError.message("Agent did not come back online after upgrade.")
    }

    private static func isRestartDisconnect(_ error: Error) -> Bool {
        let text = error.localizedDescription.lowercased()
        return text.contains("connection reset")
            || text.contains("broken pipe")
            || text.contains("cancelled")
            || text.contains("timed out")
    }
}

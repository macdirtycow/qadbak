import CryptoKit
import Foundation

struct AgentReleaseManifest: Decodable, Sendable {
    let version: String
    let minAppVersion: String?
    let minAgentVersion: String?
    let binaries: [String: AgentBinaryManifest]
}

struct AgentBinaryManifest: Decodable, Sendable {
    let sha256: String
    let file: String?
}

struct VerifiedAgentBinary: Sendable {
    let data: Data
    let manifest: AgentReleaseManifest
    let architectureKey: String
}

@MainActor
enum AgentInstallService {
    static func agentBinaryURL(for architecture: String) -> URL? {
        let normalized = architecture.lowercased()
        let name: String
        switch normalized {
        case "x86_64", "amd64":
            name = "qadbak-agent-linux-amd64"
        case "aarch64", "arm64":
            name = "qadbak-agent-linux-arm64"
        default:
            name = "qadbak-agent-linux-amd64"
        }
        return Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "Agent")
            ?? Bundle.main.url(forResource: name, withExtension: nil)
    }

    static func manifestURL() -> URL? {
        Bundle.main.url(forResource: "manifest", withExtension: "json", subdirectory: "Agent")
            ?? Bundle.main.url(forResource: "manifest", withExtension: "json")
    }

    static func loadManifest() throws -> AgentReleaseManifest {
        guard let url = manifestURL() else {
            throw APIError.message("Agent release manifest missing. Run scripts/copy-agent-to-ios.sh.")
        }
        return try JSONDecoder().decode(AgentReleaseManifest.self, from: Data(contentsOf: url))
    }

    static func architectureKey(for architecture: String) -> String {
        switch architecture.lowercased() {
        case "x86_64", "amd64":
            return "linux-amd64"
        case "aarch64", "arm64":
            return "linux-arm64"
        default:
            return "linux-amd64"
        }
    }

    static func verifiedBinary(architecture: String) throws -> VerifiedAgentBinary {
        guard let url = agentBinaryURL(for: architecture) else {
            throw APIError.message("Agent binary not bundled. Run scripts/copy-agent-to-ios.sh.")
        }
        let data = try Data(contentsOf: url)
        let manifest = try loadManifest()
        let key = architectureKey(for: architecture)
        guard let expected = manifest.binaries[key]?.sha256.lowercased(), !expected.isEmpty else {
            throw APIError.message("No checksum in manifest for \(key).")
        }
        let actual = sha256Hex(data)
        guard actual == expected else {
            throw APIError.message("Agent binary checksum mismatch. Rebuild with scripts/copy-agent-to-ios.sh.")
        }
        try AgentCompatibility.ensureAppMeetsRequirement(manifest.minAppVersion)
        return VerifiedAgentBinary(data: data, manifest: manifest, architectureKey: key)
    }

    static func loadAgentBinary(architecture: String) throws -> Data {
        try verifiedBinary(architecture: architecture).data
    }

    static func makeAgentBaseURL(host: String, port: Int) -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.port = port
        return components.url!
    }

    private static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

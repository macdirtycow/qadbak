import Foundation

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

    static func loadAgentBinary(architecture: String) throws -> Data {
        guard let url = agentBinaryURL(for: architecture) else {
            throw APIError.message("Agent binary not bundled. Run agent/scripts/build-release.sh and copy dist/* to ios/Qadbak/Resources/Agent/.")
        }
        return try Data(contentsOf: url)
    }

    static func makeAgentBaseURL(host: String, port: Int) -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.port = port
        return components.url!
    }
}

import Foundation

// MARK: - Agent API responses

struct AgentHealthResponse: Decodable {
    let ok: Bool?
    let status: String?
}

struct AgentVersionResponse: Decodable {
    let version: String?
    let minAppVersion: String?
    let minAgentVersion: String?
}

struct AgentRevokeResponse: Decodable {
    let ok: Bool?
    let error: String?
}

struct AgentMetricSample: Decodable, Identifiable {
    var id: String { timestamp ?? UUID().uuidString }
    let timestamp: String?
    let cpuPercent: Double?
    let memoryUsedBytes: Int64?
    let memoryTotalBytes: Int64?
    let diskUsedBytes: Int64?
    let diskTotalBytes: Int64?
    let loadAverage: [Double]?
}

struct AgentMetricsResponse: Decodable {
    let ok: Bool?
    let samples: [AgentMetricSample]?
}

struct AgentAuditEntry: Decodable, Identifiable {
    var id: String { "\(ts ?? "")-\(action ?? "")-\(target ?? "")" }
    let ts: String?
    let action: String?
    let target: String?
    let deviceId: String?
    let sourceIp: String?
    let result: String?
}

struct AgentAuditResponse: Decodable {
    let ok: Bool?
    let entries: [AgentAuditEntry]?
}

struct AgentDockerLogsResponse: Decodable {
    let ok: Bool?
    let lines: [String]?
    let error: String?
}

struct AgentCapabilitiesResponse: Decodable {
    let ok: Bool?
    let capabilities: AgentCapabilitiesPayload?
    let panelDetection: AgentPanelDetectionPayload?
}

struct AgentCapabilitiesPayload: Decodable {
    let systemMetrics: Bool?
    let serviceManagement: Bool?
    let dockerManagement: Bool?
    let logs: Bool?
    let packageUpdates: Bool?
    let reboot: Bool?
    let shutdown: Bool?
    let panelIntegration: Bool?

    func toServerCapabilities() -> ServerCapabilities {
        var c = ServerCapabilities()
        c.systemMetrics = systemMetrics ?? false
        c.serviceManagement = serviceManagement ?? false
        c.dockerManagement = dockerManagement ?? false
        c.logs = logs ?? false
        c.packageUpdates = packageUpdates ?? false
        c.reboot = reboot ?? false
        c.shutdown = shutdown ?? false
        c.panelIntegration = panelIntegration ?? false
        return c
    }
}

struct AgentPanelDetectionPayload: Decodable {
    let detectedPanel: String?
    let confidence: String?
    let signals: [String]?
}

struct AgentOverviewPayload: Decodable {
    let online: Bool?
    let uptimeSeconds: Int64?
    let operatingSystem: String?
    let architecture: String?
    let hostname: String?
    let agentVersion: String?
    let loadAverage: [Double]?
    let cpuPercent: Double?
    let memoryUsedBytes: Int64?
    let memoryTotalBytes: Int64?
    let diskUsedBytes: Int64?
    let diskTotalBytes: Int64?
}

struct AgentOverviewResponse: Decodable {
    let ok: Bool?
    let overview: AgentOverviewPayload?
}

struct AgentPairingInitResponse: Decodable {
    let ok: Bool?
    let pairingToken: String?
    let expiresIn: Int?
    let tlsFingerprintSha256: String?
    let error: String?
}

struct AgentPairingCompleteResponse: Decodable {
    let ok: Bool?
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let tlsFingerprintSha256: String?
    let capabilities: AgentCapabilitiesPayload?
    let panelDetection: AgentPanelDetectionPayload?
    let error: String?
}

struct AgentRotateResponse: Decodable {
    let ok: Bool?
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let error: String?
}

struct AgentErrorResponse: Decodable {
    let ok: Bool?
    let error: String?
    let code: String?
}

struct AgentServicesResponse: Decodable {
    let ok: Bool?
    let services: [AgentServicePayload]?
}

struct AgentServicePayload: Decodable {
    let id: String?
    let name: String?
    let status: String?
    let description: String?
    let canManage: Bool?

    func toManagedService() -> ManagedService? {
        guard let id = id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else { return nil }
        return ManagedService(
            id: id,
            name: name ?? id,
            status: status ?? "unknown",
            description: description,
            canManage: canManage ?? false
        )
    }
}

struct AgentContainersResponse: Decodable {
    let ok: Bool?
    let containers: [AgentContainerPayload]?
}

struct AgentContainerPayload: Decodable {
    let id: String?
    let name: String?
    let image: String?
    let status: String?
    let cpuPercent: Double?
    let memoryBytes: Int64?

    func toManagedContainer() -> ManagedContainer? {
        guard let id = id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else { return nil }
        return ManagedContainer(
            id: id,
            name: name ?? id,
            image: image ?? "",
            status: status ?? "unknown",
            cpuPercent: cpuPercent,
            memoryBytes: memoryBytes
        )
    }
}

struct AgentLogsResponse: Decodable {
    let ok: Bool?
    let lines: [String]?
    let nextCursor: String?
}

struct AgentPanelDetectionResponse: Decodable {
    let ok: Bool?
    let panelDetection: AgentPanelDetectionPayload?
}

struct AgentConfirmResponse: Decodable {
    let ok: Bool?
    let confirmToken: String?
    let expiresIn: Int?
    let error: String?
}

struct AgentActionResponse: Decodable {
    let ok: Bool?
    let error: String?
    let message: String?
}

struct AgentUpdatesResponse: Decodable {
    let ok: Bool?
    let updates: AgentUpdatesPayload?
}

struct AgentUpdatesPayload: Decodable {
    let availableCount: Int?
    let packages: [String]?
    let lastChecked: String?
    let rebootRequired: Bool?

    func toPackageUpdateInfo() -> PackageUpdateInfo {
        var checked: Date?
        if let lastChecked {
            checked = ISO8601DateFormatter().date(from: lastChecked)
        }
        return PackageUpdateInfo(
            availableCount: availableCount ?? 0,
            packages: packages ?? [],
            lastChecked: checked,
            rebootRequired: rebootRequired ?? false
        )
    }
}

// MARK: - SSH detection

struct SSHSystemProbe: Sendable {
    var architecture: String
    var operatingSystem: String
    var osID: String
    var osVersionID: String
    var hasSudo: Bool
    var panelDetection: PanelDetection
    var hostname: String
}

enum SSHAuthMethod: Sendable {
    case password(String)
    case privateKeyPEM(String, passphrase: String = "")
}

struct SSHConnectionSettings: Sendable {
    var host: String
    var port: Int
    var username: String
    var auth: SSHAuthMethod
}

enum AgentInstallStep: String, CaseIterable, Identifiable {
    case connection
    case authentication
    case detection
    case consent
    case installAndPair

    var id: String { rawValue }

    var title: String {
        switch self {
        case .connection: return "Server details"
        case .authentication: return "SSH authentication"
        case .detection: return "System detection"
        case .consent: return "Install consent"
        case .installAndPair: return "Install & pair"
        }
    }
}

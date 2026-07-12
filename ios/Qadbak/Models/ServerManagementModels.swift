import Foundation

// MARK: - Provider-facing DTOs

struct ServerOverview: Hashable, Sendable {
    var online: Bool
    var uptimeSeconds: Int?
    var operatingSystem: String?
    var agentVersion: String?
    var lastSeen: Date?
    var cpuPercent: Double?
    var memoryUsedBytes: Int64?
    var memoryTotalBytes: Int64?
    var diskUsedBytes: Int64?
    var diskTotalBytes: Int64?
    var loadAverage: [Double]?
}

struct ManagedService: Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var status: String
    var description: String?
    var canManage: Bool
}

struct ManagedContainer: Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var image: String
    var status: String
    var cpuPercent: Double?
    var memoryBytes: Int64?
}

struct ManagedLogPage: Hashable, Sendable {
    var lines: [String]
    var nextCursor: String?
}

struct PackageUpdateInfo: Hashable, Sendable {
    var availableCount: Int
    var packages: [String]
    var lastChecked: Date?
    var rebootRequired: Bool = false
}

// MARK: - Errors

enum ServerProviderError: LocalizedError {
    case notSupported(String)
    case notImplemented
    case notConnected
    case agentUpdateRequired(minVersion: String)
    case authenticationFailed
    case capabilityMissing(String)

    var errorDescription: String? {
        switch self {
        case .notSupported(let feature):
            return "\(feature) is not supported on this server."
        case .notImplemented:
            return "This feature is coming in a future update."
        case .notConnected:
            return "Server is not connected."
        case .agentUpdateRequired(let version):
            return "Agent update required (minimum \(version))."
        case .authenticationFailed:
            return "Authentication failed. Sign in again."
        case .capabilityMissing(let cap):
            return "Missing capability: \(cap)."
        }
    }
}

enum ServerFeature: String, Sendable {
    case overview
    case metrics
    case services
    case docker
    case logs
    case updates
    case reboot
    case shutdown
    case domainHosting
}

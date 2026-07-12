import Foundation

// MARK: - Server classification

enum ServerKind: String, Codable, CaseIterable, Hashable {
    case qadbakPanel
    case genericLinux
    case hestiaCP
    case coolify
    case casaOS
    case plesk
    case directAdmin
    case unknownCustom

    var displayName: String {
        switch self {
        case .qadbakPanel: return "Qadbak"
        case .genericLinux: return "Linux"
        case .hestiaCP: return "HestiaCP"
        case .coolify: return "Coolify"
        case .casaOS: return "CasaOS"
        case .plesk: return "Plesk"
        case .directAdmin: return "DirectAdmin"
        case .unknownCustom: return "Custom"
        }
    }

    var badgeLabel: String {
        switch self {
        case .qadbakPanel: return "Qadbak"
        case .genericLinux: return "Linux Agent"
        default: return displayName
        }
    }

    /// Open-source panels the Linux agent can link to for domain hosting or app management.
    var isOpenSourceLinkable: Bool {
        switch self {
        case .hestiaCP, .coolify, .casaOS: return true
        default: return false
        }
    }
}

enum ConnectionStatus: String, Codable, Hashable {
    case connecting
    case installingAgent
    case pairing
    case online
    case degraded
    case offline
    case authFailed
    case agentUpdateRequired
    case unsupportedOS

    var isReachable: Bool {
        switch self {
        case .online, .degraded: return true
        default: return false
        }
    }
}

enum AuthenticationMethod: String, Codable, Hashable {
    case qadbakMobileAuth
    case agentToken
    case agentTokenPendingPair
}

// MARK: - Capabilities & detection

struct ServerCapabilities: Codable, Hashable {
    var systemMetrics: Bool = false
    var serviceManagement: Bool = false
    var dockerManagement: Bool = false
    var fileManagement: Bool = false
    var terminal: Bool = false
    var firewall: Bool = false
    var packageUpdates: Bool = false
    var logs: Bool = false
    var reboot: Bool = false
    var shutdown: Bool = false
    var panelIntegration: Bool = false
    var backups: Bool = false
    var domainHosting: Bool = false
    var panelApps: Bool = false

    static var qadbakPanelDefaults: ServerCapabilities {
        var c = ServerCapabilities()
        c.domainHosting = true
        c.terminal = true
        c.fileManagement = true
        c.backups = true
        c.panelIntegration = true
        return c
    }

    static var agentPlaceholder: ServerCapabilities {
        var c = ServerCapabilities()
        c.systemMetrics = true
        return c
    }
}

struct PanelDetection: Codable, Hashable {
    var detectedPanel: ServerKind?
    var confidence: String?
    var signals: [String]?
    var detectedAt: Date?
}

// MARK: - Unified server profile

struct ManagedServer: Codable, Identifiable, Hashable {
    let id: String
    var displayName: String
    var hostname: String
    var ipAddress: String?
    var apiBaseURL: String
    var serverKind: ServerKind
    var operatingSystem: String?
    var architecture: String?
    var agentVersion: String?
    var connectionStatus: ConnectionStatus
    var lastSeen: Date?
    var capabilities: ServerCapabilities
    var panelDetection: PanelDetection?
    var authenticationMethod: AuthenticationMethod
    var agentPort: Int?
    var isBetaAgent: Bool
    var username: String?
    var lastUsedAt: Date

    var displayHost: String {
        if !hostname.isEmpty { return hostname }
        return URL(string: apiBaseURL)?.host ?? apiBaseURL
    }

    var subtitle: String {
        var parts: [String] = []
        if let username, !username.isEmpty { parts.append(username) }
        parts.append(displayHost)
        return parts.joined(separator: " · ")
    }

    var isQadbakPanel: Bool {
        authenticationMethod == .qadbakMobileAuth && serverKind == .qadbakPanel
    }

    var isAgentManaged: Bool {
        authenticationMethod == .agentToken || authenticationMethod == .agentTokenPendingPair
    }

    /// Legacy alias used during migration from SavedServer.
    var serverURL: String { apiBaseURL }

    static func qadbakPanel(
        id: String = UUID().uuidString,
        label: String,
        serverURL: String,
        username: String? = nil,
        lastUsedAt: Date = Date()
    ) -> ManagedServer {
        let host = URL(string: serverURL)?.host ?? label
        return ManagedServer(
            id: id,
            displayName: label,
            hostname: host,
            ipAddress: nil,
            apiBaseURL: serverURL,
            serverKind: .qadbakPanel,
            operatingSystem: nil,
            architecture: nil,
            agentVersion: nil,
            connectionStatus: .offline,
            lastSeen: nil,
            capabilities: .qadbakPanelDefaults,
            panelDetection: nil,
            authenticationMethod: .qadbakMobileAuth,
            agentPort: nil,
            isBetaAgent: false,
            username: username,
            lastUsedAt: lastUsedAt
        )
    }

    static func linuxAgentPending(
        displayName: String,
        hostname: String,
        ipAddress: String?,
        agentPort: Int = 9443
    ) -> ManagedServer {
        let base = "https://\(hostname):\(agentPort)"
        return ManagedServer(
            id: UUID().uuidString,
            displayName: displayName,
            hostname: hostname,
            ipAddress: ipAddress,
            apiBaseURL: base,
            serverKind: .genericLinux,
            operatingSystem: nil,
            architecture: nil,
            agentVersion: nil,
            connectionStatus: .connecting,
            lastSeen: nil,
            capabilities: .agentPlaceholder,
            panelDetection: nil,
            authenticationMethod: .agentTokenPendingPair,
            agentPort: agentPort,
            isBetaAgent: true,
            username: nil,
            lastUsedAt: Date()
        )
    }
}

// MARK: - Legacy SavedServer (decode-only migration)

struct SavedServer: Codable, Identifiable, Hashable {
    let id: String
    var label: String
    var serverURL: String
    var username: String?
    var lastUsedAt: Date

    var displayHost: String {
        URL(string: serverURL)?.host ?? serverURL
    }

    var subtitle: String {
        if let username, !username.isEmpty {
            return "\(username) · \(displayHost)"
        }
        return displayHost
    }

    func toManagedServer() -> ManagedServer {
        ManagedServer.qadbakPanel(
            id: id,
            label: label,
            serverURL: serverURL,
            username: username,
            lastUsedAt: lastUsedAt
        )
    }
}

extension ManagedServer {
    /// Panel servers can still be passed where SavedServer was expected.
    func asSavedServer() -> SavedServer {
        SavedServer(
            id: id,
            label: displayName,
            serverURL: apiBaseURL,
            username: username,
            lastUsedAt: lastUsedAt
        )
    }
}

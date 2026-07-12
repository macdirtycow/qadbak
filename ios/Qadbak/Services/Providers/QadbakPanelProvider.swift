import Foundation

/// Qadbak panel server — wraps existing mobile API (domain hosting).
@MainActor
final class QadbakPanelProvider: ServerManagementProvider {
    let server: ManagedServer
    private let api: QadbakAPI

    init(server: ManagedServer, api: QadbakAPI) {
        self.server = server
        self.api = api
    }

    func supports(_ feature: ServerFeature) -> Bool {
        switch feature {
        case .domainHosting:
            return server.capabilities.domainHosting
        case .overview:
            return true
        default:
            return false
        }
    }

    func fetchOverview() async throws -> ServerOverview {
        let health = try await api.healthSummary()
        let online = !health.lowercased().contains("unavailable")
        return ServerOverview(
            online: online,
            uptimeSeconds: nil,
            operatingSystem: nil,
            agentVersion: nil,
            lastSeen: Date(),
            cpuPercent: nil,
            memoryUsedBytes: nil,
            memoryTotalBytes: nil,
            diskUsedBytes: nil,
            diskTotalBytes: nil,
            loadAverage: nil
        )
    }
}

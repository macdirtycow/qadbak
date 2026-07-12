import Foundation

/// Abstract server management — panel or standalone agent.
@MainActor
protocol ServerManagementProvider: AnyObject {
    var server: ManagedServer { get }

    func supports(_ feature: ServerFeature) -> Bool

    func fetchOverview() async throws -> ServerOverview
    func fetchServices() async throws -> [ManagedService]
    func restartService(id: String) async throws
    func startService(id: String) async throws
    func stopService(id: String) async throws
    func fetchContainers() async throws -> [ManagedContainer]
    func restartContainer(id: String) async throws
    func fetchLogs(source: String, cursor: String?) async throws -> ManagedLogPage
    func fetchUpdates() async throws -> PackageUpdateInfo
    func installUpdates() async throws
    func reboot() async throws
    func shutdown() async throws
}

extension ServerManagementProvider {
    func supports(_ feature: ServerFeature) -> Bool {
        let caps = server.capabilities
        switch feature {
        case .overview, .metrics:
            return caps.systemMetrics || caps.domainHosting
        case .services:
            return caps.serviceManagement
        case .docker:
            return caps.dockerManagement
        case .logs:
            return caps.logs
        case .updates:
            return caps.packageUpdates
        case .reboot:
            return caps.reboot
        case .shutdown:
            return caps.shutdown
        case .domainHosting:
            return caps.domainHosting
        }
    }

    func fetchServices() async throws -> [ManagedService] {
        throw ServerProviderError.notSupported("Services")
    }

    func restartService(id: String) async throws {
        throw ServerProviderError.notSupported("Service restart")
    }

    func startService(id: String) async throws {
        throw ServerProviderError.notSupported("Service start")
    }

    func stopService(id: String) async throws {
        throw ServerProviderError.notSupported("Service stop")
    }

    func fetchContainers() async throws -> [ManagedContainer] {
        throw ServerProviderError.notSupported("Docker")
    }

    func restartContainer(id: String) async throws {
        throw ServerProviderError.notSupported("Container restart")
    }

    func fetchLogs(source: String, cursor: String?) async throws -> ManagedLogPage {
        throw ServerProviderError.notSupported("Logs")
    }

    func fetchUpdates() async throws -> PackageUpdateInfo {
        throw ServerProviderError.notSupported("Updates")
    }

    func installUpdates() async throws {
        throw ServerProviderError.notSupported("Updates")
    }

    func reboot() async throws {
        throw ServerProviderError.notSupported("Reboot")
    }

    func shutdown() async throws {
        throw ServerProviderError.notSupported("Shutdown")
    }
}

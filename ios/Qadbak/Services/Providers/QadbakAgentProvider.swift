import Foundation

/// Standalone Linux agent provider (HTTPS + pinned TLS).
@MainActor
final class QadbakAgentProvider: ServerManagementProvider {
    private(set) var server: ManagedServer
    private let client: AgentAPIClient

    init(server: ManagedServer, client: AgentAPIClient) {
        self.server = server
        self.client = client
    }

    func updateServer(_ server: ManagedServer) {
        self.server = server
    }

    func supports(_ feature: ServerFeature) -> Bool {
        guard server.authenticationMethod == .agentToken else { return false }
        let caps = server.capabilities
        switch feature {
        case .overview, .metrics:
            return caps.systemMetrics
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

    func fetchOverview() async throws -> ServerOverview {
        guard server.authenticationMethod == .agentToken else {
            throw ServerProviderError.notConnected
        }
        let payload = try await client.overview()
        return payload.toServerOverview()
    }

    func fetchServices() async throws -> [ManagedService] {
        guard supports(.services) else {
            throw ServerProviderError.capabilityMissing("serviceManagement")
        }
        return try await client.services()
    }

    func fetchContainers() async throws -> [ManagedContainer] {
        guard supports(.docker) else {
            throw ServerProviderError.capabilityMissing("dockerManagement")
        }
        return try await client.containers()
    }

    func fetchLogs(source: String, cursor: String?) async throws -> ManagedLogPage {
        try await fetchLogPage(source: source, cursor: cursor, before: false)
    }

    func fetchOlderLogs(source: String, cursor: String) async throws -> ManagedLogPage {
        try await fetchLogPage(source: source, cursor: cursor, before: true)
    }

    func restartService(id: String) async throws {
        try await confirmedServiceAction(id: id, action: "service.restart") { token in
            try await client.restartService(id: id, confirmToken: token)
        }
    }

    func startService(id: String) async throws {
        try await confirmedServiceAction(id: id, action: "service.start") { token in
            try await client.startService(id: id, confirmToken: token)
        }
    }

    func stopService(id: String) async throws {
        try await confirmedServiceAction(id: id, action: "service.stop") { token in
            try await client.stopService(id: id, confirmToken: token)
        }
    }

    func restartContainer(id: String) async throws {
        try await confirmedContainerAction(id: id, action: "docker.restart") { token in
            try await client.restartContainer(id: id, confirmToken: token)
        }
    }

    func fetchUpdates() async throws -> PackageUpdateInfo {
        guard supports(.updates) else {
            throw ServerProviderError.capabilityMissing("packageUpdates")
        }
        return try await client.fetchUpdates()
    }

    func installUpdates() async throws {
        guard supports(.updates) else {
            throw ServerProviderError.capabilityMissing("packageUpdates")
        }
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "updates.install",
            target: "*"
        ) { token in
            try await client.installUpdates(confirmToken: token)
        }
    }

    func reboot() async throws {
        guard supports(.reboot) else {
            throw ServerProviderError.capabilityMissing("reboot")
        }
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "system.reboot",
            target: "*"
        ) { token in
            try await client.rebootServer(confirmToken: token)
        }
    }

    func shutdown() async throws {
        guard supports(.shutdown) else {
            throw ServerProviderError.capabilityMissing("shutdown")
        }
        try await AgentConfirmedAction.confirmAndRun(
            client: client,
            action: "system.shutdown",
            target: "*"
        ) { token in
            try await client.shutdownServer(confirmToken: token)
        }
    }

    var apiClient: AgentAPIClient { client }

    private func fetchLogPage(source: String, cursor: String?, before: Bool) async throws -> ManagedLogPage {
        guard supports(.logs) else {
            throw ServerProviderError.capabilityMissing("logs")
        }
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "journal" {
            return try await client.logs(source: "journal", filter: nil, cursor: cursor, before: before)
        }
        let unit = trimmed.hasSuffix(".service") ? trimmed : "\(trimmed).service"
        return try await client.logs(source: "service", filter: unit, cursor: cursor, before: before)
    }

    private func confirmedServiceAction(
        id: String,
        action: String,
        run: (String) async throws -> Void
    ) async throws {
        guard supports(.services) else {
            throw ServerProviderError.capabilityMissing("serviceManagement")
        }
        try await AgentConfirmedAction.confirmAndRun(client: client, action: action, target: id, run: run)
    }

    private func confirmedContainerAction(
        id: String,
        action: String,
        run: (String) async throws -> Void
    ) async throws {
        guard supports(.docker) else {
            throw ServerProviderError.capabilityMissing("dockerManagement")
        }
        try await AgentConfirmedAction.confirmAndRun(client: client, action: action, target: id, run: run)
    }
}

extension QadbakAgentProvider {
    func startContainer(id: String) async throws {
        try await confirmedContainerAction(id: id, action: "docker.start") { token in
            try await client.startContainer(id: id, confirmToken: token)
        }
    }

    func stopContainer(id: String) async throws {
        try await confirmedContainerAction(id: id, action: "docker.stop") { token in
            try await client.stopContainer(id: id, confirmToken: token)
        }
    }
}

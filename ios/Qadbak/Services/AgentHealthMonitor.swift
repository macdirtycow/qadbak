import Foundation
import UserNotifications

/// Polls paired agent servers and posts local notifications on state changes (MVP).
@MainActor
final class AgentHealthMonitor {
    static let shared = AgentHealthMonitor()

    private var loopTask: Task<Void, Never>?
    private var lastSnapshot: [String: ServerHealthSnapshot] = [:]
    private let pollInterval: UInt64 = 5 * 60 * 1_000_000_000

    private init() {}

    func start(appState: AppState) {
        loopTask?.cancel()
        loopTask = Task { [weak appState] in
            while !Task.isCancelled {
                if let appState {
                    await poll(appState: appState)
                }
                try? await Task.sleep(nanoseconds: pollInterval)
            }
        }
    }

    func stop() {
        loopTask?.cancel()
        loopTask = nil
    }

    func poll(appState: AppState) async {
        guard AgentNotificationSettings.enabled else { return }

        let servers = appState.savedServers.filter {
            $0.isAgentManaged && $0.authenticationMethod == .agentToken && appState.hasStoredSession(for: $0)
        }
        guard !servers.isEmpty else { return }

        for server in servers {
            await pollServer(server, appState: appState)
        }
    }

    private func pollServer(_ server: ManagedServer, appState: AppState) async {
        guard let client = appState.makeAgentClient(for: server) else { return }

        var snapshot = ServerHealthSnapshot(serverId: server.id, online: false)

        do {
            let overview = try await client.overview()
            snapshot.online = overview.online ?? true
            snapshot.cpuPercent = overview.cpuPercent

            if server.capabilities.packageUpdates, let updates = try? await client.fetchUpdates(), updates.availableCount > 0 {
                snapshot.pendingUpdates = updates.availableCount
            }

            if server.capabilities.serviceManagement, let services = try? await client.services() {
                snapshot.failedServices = services.filter { $0.status.lowercased() == "failed" }.count
            }

            var profile = server
            profile.connectionStatus = .online
            profile.lastSeen = Date()
            if let caps = try? await client.capabilities().capabilities?.toServerCapabilities() {
                profile.capabilities = caps
            }
            if let detection = try? await client.panelDetection().panelDetection?.toPanelDetection() {
                profile.panelDetection = detection
                if let kind = detection.detectedPanel, kind != .genericLinux {
                    profile.serverKind = kind
                }
            }
            appState.updateServerProfileIfExists(profile)
        } catch {
            snapshot.online = false
        }

        let previous = lastSnapshot[server.id]
        await emitTransitions(server: server, previous: previous, current: snapshot)
        lastSnapshot[server.id] = snapshot
    }

    private func emitTransitions(
        server: ManagedServer,
        previous: ServerHealthSnapshot?,
        current: ServerHealthSnapshot
    ) async {
        let name = server.displayName

        if previous?.online == true, !current.online {
            await notify(
                id: "offline-\(server.id)",
                title: "\(name) offline",
                body: "Could not reach the Qadbak Agent. Check network or SSH access."
            )
        } else if previous?.online == false, current.online {
            await notify(
                id: "online-\(server.id)-\(Int(Date().timeIntervalSince1970))",
                title: "\(name) back online",
                body: "Agent connection restored."
            )
        }

        if let cpu = current.cpuPercent, cpu >= 90, (previous?.cpuPercent ?? 0) < 90 {
            await notify(
                id: "cpu-\(server.id)-\(Int(Date().timeIntervalSince1970 / 3600))",
                title: "High CPU on \(name)",
                body: String(format: "CPU usage is %.0f%%.", cpu)
            )
        }

        if current.failedServices > 0, (previous?.failedServices ?? 0) == 0 {
            await notify(
                id: "svc-\(server.id)-\(Int(Date().timeIntervalSince1970 / 3600))",
                title: "Service failure on \(name)",
                body: "\(current.failedServices) systemd unit(s) in failed state."
            )
        }

        if let count = current.pendingUpdates, count > 0, (previous?.pendingUpdates ?? 0) == 0 {
            await notify(
                id: "upd-\(server.id)-\(Int(Date().timeIntervalSince1970 / 86400))",
                title: "Updates on \(name)",
                body: "\(count) package(s) can be upgraded."
            )
        }
    }

    private func notify(id: String, title: String, body: String) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(identifier: id, content: content, trigger: nil)
        try? await center.add(request)
    }
}

private struct ServerHealthSnapshot {
    let serverId: String
    var online: Bool
    var cpuPercent: Double?
    var failedServices: Int = 0
    var pendingUpdates: Int?
}

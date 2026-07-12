import Foundation
import Network

enum BackupNetworkPolicy {
    enum PolicyError: LocalizedError {
        case offline
        case wifiRequired

        var errorDescription: String? {
            switch self {
            case .offline:
                return "No internet connection."
            case .wifiRequired:
                return "Backup download requires Wi-Fi. Connect to Wi-Fi or turn off “Wi-Fi only” in Backups."
            }
        }
    }

    static func ensureAllowsDownload(wifiOnly: Bool) async throws {
        let path = await currentPath()
        guard path.status == .satisfied else {
            throw PolicyError.offline
        }
        if wifiOnly, !path.usesInterfaceType(.wifi) {
            throw PolicyError.wifiRequired
        }
    }

    private static func currentPath() async -> NWPath {
        await withCheckedContinuation { continuation in
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { path in
                monitor.cancel()
                continuation.resume(returning: path)
            }
            monitor.start(queue: DispatchQueue(label: "com.qadbak.backup.network"))
        }
    }
}

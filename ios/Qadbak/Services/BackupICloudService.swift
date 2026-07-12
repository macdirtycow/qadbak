import Foundation

/// Downloads domain backup archives from the panel and stores copies in the user's iCloud Drive.
@MainActor
final class BackupICloudService {
    enum ServiceError: LocalizedError {
        case iCloudUnavailable
        case invalidDownload
        case http(Int, String?)
        case network(LocalizedError)

        var errorDescription: String? {
            switch self {
            case .iCloudUnavailable:
                return "Sign in to iCloud on this iPhone and enable iCloud Drive in Settings."
            case .invalidDownload:
                return "Backup download failed — empty or invalid file from server."
            case .http(let code, let message):
                if let message, !message.isEmpty { return message }
                return "Backup download failed (HTTP \(code))."
            case .network(let error):
                return error.errorDescription
            }
        }
    }

    private let baseURL: URL
    private let tokenProvider: () -> String?
    private let refreshHandler: () async throws -> Void
    private let session: URLSession

    init(
        baseURL: URL,
        tokenProvider: @escaping () -> String?,
        refreshHandler: @escaping () async throws -> Void
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.refreshHandler = refreshHandler
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 1_800
        config.timeoutIntervalForResource = 7_200
        self.session = URLSession(configuration: config)
    }

    static var iCloudAvailable: Bool {
        FileManager.default.ubiquityIdentityToken != nil
    }

    func downloadBackup(domain: String, archiveName: String) async throws -> URL {
        try await performDownload(domain: domain, archiveName: archiveName, retried: false)
    }

    func saveToICloud(localFile: URL, domain: String, fileName: String) throws -> URL {
        guard Self.iCloudAvailable else {
            throw ServiceError.iCloudUnavailable
        }
        guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
            throw ServiceError.iCloudUnavailable
        }

        let folder = container
            .appendingPathComponent("Documents", isDirectory: true)
            .appendingPathComponent("Qadbak Backups", isDirectory: true)
            .appendingPathComponent(domain, isDirectory: true)

        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        let destination = folder.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.copyItem(at: localFile, to: destination)
        return destination
    }

    func downloadAndSaveToICloud(
        domain: String,
        archiveName: String,
        wifiOnly: Bool = BackupICloudSettings.wifiOnly
    ) async throws -> URL {
        try await BackupNetworkPolicy.ensureAllowsDownload(wifiOnly: wifiOnly)
        let local = try await downloadBackup(domain: domain, archiveName: archiveName)
        defer { try? FileManager.default.removeItem(at: local) }
        return try saveToICloud(localFile: local, domain: domain, fileName: archiveName)
    }

    private func performDownload(
        domain: String,
        archiveName: String,
        retried: Bool
    ) async throws -> URL {
        let encodedDomain = domain.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? domain
        var components = URLComponents(
            url: baseURL.appendingPathComponent("/api/domains/\(encodedDomain)/backups/download"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "name", value: archiveName)]
        guard let url = components?.url else {
            throw APIError.message("Invalid backup download URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/gzip", forHTTPHeaderField: "Accept")
        request.setValue("Qadbak-iOS/1.0", forHTTPHeaderField: "User-Agent")
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (tempURL, response) = try await session.download(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.invalidDownload
        }

        if http.statusCode == 401, !retried {
            try await refreshHandler()
            return try await performDownload(domain: domain, archiveName: archiveName, retried: true)
        }

        guard (200 ... 299).contains(http.statusCode) else {
            let body = try? String(contentsOf: tempURL, encoding: .utf8)
            let message = body.flatMap { snippet in
                (try? JSONDecoder().decode(APIErrorResponse.self, from: Data(snippet.utf8))).flatMap(\.error)
            }
            throw ServiceError.http(http.statusCode, message)
        }

        let attrs = try FileManager.default.attributesOfItem(atPath: tempURL.path)
        let size = (attrs[.size] as? NSNumber)?.intValue ?? 0
        guard size > 0 else {
            throw ServiceError.invalidDownload
        }

        let safeName = archiveName.replacingOccurrences(of: "/", with: "_")
        let persisted = FileManager.default.temporaryDirectory
            .appendingPathComponent("qadbak-backup-\(UUID().uuidString)-\(safeName)")
        if FileManager.default.fileExists(atPath: persisted.path) {
            try FileManager.default.removeItem(at: persisted)
        }
        try FileManager.default.moveItem(at: tempURL, to: persisted)
        return persisted
    }
}

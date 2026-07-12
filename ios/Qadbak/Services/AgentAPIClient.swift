import CryptoKit
import Foundation

/// HTTPS client for the Qadbak Linux agent with TLS certificate pinning.
final class AgentAPIClient: NSObject, @unchecked Sendable {
    private let baseURL: URL
    private let pinnedFingerprint: String?
    private var accessToken: String?
    private let refreshTokenProvider: () -> String?
    private let onTokensRefreshed: (String, String) -> Void

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 45
        config.timeoutIntervalForResource = 120
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    init(
        baseURL: URL,
        pinnedFingerprint: String?,
        accessToken: String? = nil,
        refreshTokenProvider: @escaping () -> String?,
        onTokensRefreshed: @escaping (String, String) -> Void
    ) {
        self.baseURL = baseURL
        self.pinnedFingerprint = pinnedFingerprint?.lowercased()
        self.accessToken = accessToken
        self.refreshTokenProvider = refreshTokenProvider
        self.onTokensRefreshed = onTokensRefreshed
    }

    func setAccessToken(_ token: String?) {
        accessToken = token
    }

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        authorized: Bool = true,
        retried: Bool = false
    ) async throws -> T {
        let data = try await requestData(
            method,
            path: path,
            body: body,
            confirmToken: nil,
            authorized: authorized,
            retried: retried
        )
        return try JSONDecoder().decode(T.self, from: data)
    }

    func pairingInit() async throws -> AgentPairingInitResponse {
        try await request("POST", path: "/api/v1/pairing/init", authorized: false)
    }

    func pairingComplete(
        pairingToken: String,
        deviceId: String,
        deviceLabel: String
    ) async throws -> AgentPairingCompleteResponse {
        struct Body: Encodable {
            let pairingToken: String
            let deviceId: String
            let deviceLabel: String
        }
        return try await request(
            "POST",
            path: "/api/v1/pairing/complete",
            body: Body(pairingToken: pairingToken, deviceId: deviceId, deviceLabel: deviceLabel),
            authorized: false
        )
    }

    func rotate() async throws -> AgentRotateResponse {
        guard let refresh = refreshTokenProvider() else {
            throw APIError.unauthorized
        }
        struct Body: Encodable { let refreshToken: String }
        let res: AgentRotateResponse = try await request(
            "POST",
            path: "/api/v1/auth/rotate",
            body: Body(refreshToken: refresh),
            authorized: false
        )
        if let access = res.accessToken, let refresh = res.refreshToken {
            accessToken = access
            onTokensRefreshed(access, refresh)
        }
        return res
    }

    func overview() async throws -> AgentOverviewPayload {
        let res: AgentOverviewResponse = try await request("GET", path: "/api/v1/system/overview")
        guard let overview = res.overview else {
            throw APIError.message("Overview unavailable.")
        }
        return overview
    }

    func capabilities() async throws -> AgentCapabilitiesResponse {
        try await request("GET", path: "/api/v1/capabilities")
    }

    func panelDetection() async throws -> AgentPanelDetectionResponse {
        try await request("GET", path: "/api/v1/detection/panel")
    }

    func services() async throws -> [ManagedService] {
        let res: AgentServicesResponse = try await request("GET", path: "/api/v1/services")
        return (res.services ?? []).compactMap { $0.toManagedService() }
    }

    func containers() async throws -> [ManagedContainer] {
        let res: AgentContainersResponse = try await request("GET", path: "/api/v1/docker/containers")
        return (res.containers ?? []).compactMap { $0.toManagedContainer() }
    }

    func logs(source: String, filter: String?, cursor: String?, tail: Int = 200, before: Bool = false) async throws -> ManagedLogPage {
        var components = URLComponents()
        components.path = "/api/v1/logs"
        var items = [URLQueryItem(name: "source", value: source)]
        if let filter, !filter.isEmpty {
            items.append(URLQueryItem(name: "filter", value: filter))
        }
        if let cursor, !cursor.isEmpty {
            items.append(URLQueryItem(name: "cursor", value: cursor))
        }
        if before {
            items.append(URLQueryItem(name: "before", value: "1"))
        }
        items.append(URLQueryItem(name: "tail", value: String(tail)))
        components.queryItems = items
        let path = components.string ?? "/api/v1/logs"
        let res: AgentLogsResponse = try await request("GET", path: path)
        return ManagedLogPage(lines: res.lines ?? [], nextCursor: res.nextCursor)
    }

    private func requestData(
        _ method: String,
        path: String,
        body: Encodable?,
        confirmToken: String?,
        authorized: Bool,
        retried: Bool
    ) async throws -> Data {
        let url = try resolveURL(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Qadbak-iOS/1.0", forHTTPHeaderField: "User-Agent")
        if authorized, let token = accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let confirmToken, !confirmToken.isEmpty {
            req.setValue(confirmToken, forHTTPHeaderField: "X-Qadbak-Confirm")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodableAgent(body))
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.message("No response from agent.")
        }

        if http.statusCode == 401, authorized, !retried {
            _ = try await rotate()
            return try await requestData(
                method,
                path: path,
                body: body,
                confirmToken: confirmToken,
                authorized: authorized,
                retried: true
            )
        }

        guard (200 ... 299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(AgentErrorResponse.self, from: data)).flatMap(\.error)
            throw APIError.http(http.statusCode, message)
        }
        return data
    }

    private func resolveURL(_ path: String) throws -> URL {
        let normalized = path.hasPrefix("/") ? path : "/\(path)"
        guard let url = URL(string: normalized, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.message("Invalid agent URL.")
        }
        return url
    }
}

extension AgentAPIClient: URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              let pinnedFingerprint, !pinnedFingerprint.isEmpty else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        if let fp = ServerTrustFingerprint.sha256(trust), fp == pinnedFingerprint {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

enum ServerTrustFingerprint {
    static func sha256(_ trust: SecTrust) -> String? {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let cert = chain.first else { return nil }
        let data = SecCertificateCopyData(cert) as Data
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

private struct AnyEncodableAgent: Encodable {
    private let encode: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encode = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encode(encoder) }
}

extension AgentOverviewPayload {
    func toServerOverview(lastSeen: Date = Date()) -> ServerOverview {
        ServerOverview(
            online: online ?? true,
            uptimeSeconds: uptimeSeconds.map { Int($0) },
            operatingSystem: operatingSystem,
            agentVersion: agentVersion,
            lastSeen: lastSeen,
            cpuPercent: cpuPercent,
            memoryUsedBytes: memoryUsedBytes,
            memoryTotalBytes: memoryTotalBytes,
            diskUsedBytes: diskUsedBytes,
            diskTotalBytes: diskTotalBytes,
            loadAverage: loadAverage
        )
    }
}

extension AgentPanelDetectionPayload {
    func toPanelDetection() -> PanelDetection {
        PanelDetection(
            detectedPanel: detectedPanel.flatMap { ServerKind(rawValue: $0) },
            confidence: confidence,
            signals: signals,
            detectedAt: Date()
        )
    }
}

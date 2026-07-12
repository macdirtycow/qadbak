import CryptoKit
import Foundation

/// HTTPS client for the Qadbak Linux agent with TLS certificate pinning.
final class AgentAPIClient: NSObject, @unchecked Sendable, URLSessionDelegate, URLSessionTaskDelegate {
    private let baseURL: URL
    private let pinnedFingerprint: String?
    private var accessToken: String?
    private let refreshTokenProvider: () -> String?
    private let onTokensRefreshed: (String, String) -> Void
    private var session: URLSession!
    private let delegateQueue = OperationQueue()

    init(
        baseURL: URL,
        pinnedFingerprint: String?,
        accessToken: String? = nil,
        refreshTokenProvider: @escaping () -> String?,
        onTokensRefreshed: @escaping (String, String) -> Void
    ) {
        self.baseURL = baseURL
        self.pinnedFingerprint = pinnedFingerprint?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        self.accessToken = accessToken
        self.refreshTokenProvider = refreshTokenProvider
        self.onTokensRefreshed = onTokensRefreshed
        super.init()
        delegateQueue.maxConcurrentOperationCount = 1
        delegateQueue.name = "com.qadbak.agent-api-client"
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 90
        config.timeoutIntervalForResource = 180
        config.waitsForConnectivity = true
        session = URLSession(configuration: config, delegate: self, delegateQueue: delegateQueue)
    }

    deinit {
        session.invalidateAndCancel()
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

    func version() async throws -> AgentVersionResponse {
        try await request("GET", path: "/api/v1/version", authorized: false)
    }

    func revoke() async throws {
        guard let refresh = refreshTokenProvider() else { return }
        struct Body: Encodable { let refreshToken: String }
        let _: AgentRevokeResponse = try await request(
            "POST",
            path: "/api/v1/auth/revoke",
            body: Body(refreshToken: refresh),
            authorized: true
        )
    }

    func metrics(limit: Int = 60) async throws -> [AgentMetricSample] {
        let res: AgentMetricsResponse = try await request("GET", path: "/api/v1/system/metrics?limit=\(limit)")
        return res.samples ?? []
    }

    func auditLog(tail: Int = 200) async throws -> [AgentAuditEntry] {
        let res: AgentAuditResponse = try await request("GET", path: "/api/v1/audit?tail=\(tail)")
        return res.entries ?? []
    }

    func dockerLogs(containerId: String, tail: Int = 200) async throws -> [String] {
        let encoded = containerId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? containerId
        let res: AgentDockerLogsResponse = try await request(
            "GET",
            path: "/api/v1/docker/containers/\(encoded)/logs?tail=\(tail)"
        )
        if res.ok == false {
            throw APIError.message(res.error ?? "Could not load container logs.")
        }
        return res.lines ?? []
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

    func panelLinkStatus() async throws -> AgentPanelLinkStatusResponse {
        try await request("GET", path: "/api/v1/panels/link")
    }

    func linkPanel(_ body: PanelLinkRequest) async throws -> AgentPanelLinkStatusResponse {
        try await request("POST", path: "/api/v1/panels/link", body: body)
    }

    func unlinkPanel() async throws {
        let _: AgentActionResponse = try await request("DELETE", path: "/api/v1/panels/link")
    }

    func panelOverview() async throws -> AgentPanelOverviewPayload {
        let res: AgentPanelOverviewResponse = try await request("GET", path: "/api/v1/panels/overview")
        guard let overview = res.overview else {
            throw APIError.message(res.error ?? "Panel overview unavailable.")
        }
        return overview
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

    func requestData(
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

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch let error as URLError where error.code == .secureConnectionFailed || error.code == .serverCertificateUntrusted || error.code == .clientCertificateRejected {
            throw APIError.message(
                "Agent TLS connection failed (\(error.code.rawValue)). Confirm Tailscale is on, host is the agent IP (not SSH IP), and install Qadbak build 8+ from Desktop."
            )
        }
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

extension AgentAPIClient {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        handleAuthenticationChallenge(challenge, completionHandler: completionHandler)
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        handleAuthenticationChallenge(challenge, completionHandler: completionHandler)
    }

    private func handleAuthenticationChallenge(
        _ challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        if let pinnedFingerprint, !pinnedFingerprint.isEmpty {
            guard let fp = ServerTrustFingerprint.sha256(trust), fp == pinnedFingerprint else {
                completionHandler(.cancelAuthenticationChallenge, nil)
                return
            }
        }

        completionHandler(.useCredential, URLCredential(trust: trust))
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

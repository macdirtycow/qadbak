import CryptoKit
import Foundation

enum ServerTrustFingerprint {
    static func sha256(_ trust: SecTrust) -> String? {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let cert = chain.first else { return nil }
        let data = SecCertificateCopyData(cert) as Data
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

/// HTTPS client for the Qadbak Linux agent with TLS certificate pinning.
final class AgentAPIClient: @unchecked Sendable {
    private let baseURL: URL
    private let pinnedFingerprint: String?
    private var accessToken: String?
    private let refreshTokenProvider: () -> String?
    private let onTokensRefreshed: (String, String) -> Void

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
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch let error as DecodingError {
            throw APIError.message("Agent returned unexpected JSON (\(error.localizedDescription)).")
        }
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

    func hestiaSetup() async throws -> AgentPanelLinkStatusResponse {
        try await request("GET", path: "/api/v1/panels/hestia/setup")
    }

    func hestiaBootstrap(autoLink: Bool = true) async throws -> AgentHestiaBootstrapResponse {
        struct Body: Encodable {
            let autoLink: Bool
        }
        return try await request(
            "POST",
            path: "/api/v1/panels/hestia/bootstrap",
            body: Body(autoLink: autoLink),
            authorized: true
        )
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
        var bodyData: Data?
        if let body {
            bodyData = try JSONEncoder().encode(AnyEncodableAgent(body))
        }
        return try await requestRawData(
            method,
            path: path,
            body: bodyData,
            extraHeaders: [:],
            confirmToken: confirmToken,
            authorized: authorized,
            retried: retried,
            timeout: 90
        )
    }

    func requestRawData(
        _ method: String,
        path: String,
        body: Data?,
        extraHeaders: [String: String],
        confirmToken: String?,
        authorized: Bool,
        retried: Bool,
        timeout: TimeInterval = 90
    ) async throws -> Data {
        let url = try resolveURL(path)
        var headers: [String: String] = extraHeaders
        if authorized, let token = accessToken {
            headers["Authorization"] = "Bearer \(token)"
        }
        if let confirmToken, !confirmToken.isEmpty {
            headers["X-Qadbak-Confirm"] = confirmToken
        }

        let response = try await AgentHTTPSClient.request(
            method: method,
            url: url,
            headers: headers,
            body: body,
            pinnedFingerprint: pinnedFingerprint,
            timeout: timeout
        )

        if response.statusCode == 401, authorized, !retried {
            _ = try await rotate()
            return try await requestRawData(
                method,
                path: path,
                body: body,
                extraHeaders: extraHeaders,
                confirmToken: confirmToken,
                authorized: authorized,
                retried: true,
                timeout: timeout
            )
        }

        guard (200 ... 299).contains(response.statusCode) else {
            let message = (try? JSONDecoder().decode(AgentErrorResponse.self, from: response.body)).flatMap(\.error)
            throw APIError.http(response.statusCode, message)
        }
        return response.body
    }

    func uploadMultipart(
        path: String,
        fields: [String: String],
        files: [(fieldName: String, fileName: String, mimeType: String, data: Data)],
        authorized: Bool = true,
        retried: Bool = false
    ) async throws -> Data {
        let boundary = "QadbakAgentBoundary-\(UUID().uuidString)"
        var body = Data()
        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        for file in files {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append(
                "Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.fileName)\"\r\n"
                    .data(using: .utf8)!
            )
            body.append("Content-Type: \(file.mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(file.data)
            body.append("\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        return try await requestRawData(
            "POST",
            path: path,
            body: body,
            extraHeaders: ["Content-Type": "multipart/form-data; boundary=\(boundary)"],
            confirmToken: nil,
            authorized: authorized,
            retried: retried,
            timeout: 300
        )
    }

    func upgradeAgent(binary: Data, version: String, sha256: String) async throws {
        let token = try await requestConfirm(action: "agent.upgrade", target: version)
        _ = try await requestRawData(
            "POST",
            path: "/api/v1/agent/upgrade",
            body: binary,
            extraHeaders: [
                "Content-Type": "application/octet-stream",
                "X-Agent-Version": version,
                "X-Agent-SHA256": sha256.lowercased(),
            ],
            confirmToken: token,
            authorized: true,
            retried: false,
            timeout: 300
        )
    }

    private func resolveURL(_ path: String) throws -> URL {
        let normalized = path.hasPrefix("/") ? path : "/\(path)"
        guard let url = URL(string: normalized, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.message("Invalid agent URL.")
        }
        return url
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

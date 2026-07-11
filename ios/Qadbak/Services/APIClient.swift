import Foundation

final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?
    private let refreshHandler: () async throws -> Void

    init(
        baseURL: URL,
        tokenProvider: @escaping () -> String?,
        refreshHandler: @escaping () async throws -> Void
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.refreshHandler = refreshHandler
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        self.session = URLSession(configuration: config)
    }

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        authorized: Bool = true,
        retried: Bool = false
    ) async throws -> T {
        let data = try await requestData(method, path: path, body: body, authorized: authorized, retried: retried)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            if let snippet = String(data: data.prefix(180), encoding: .utf8)?
                .replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !snippet.isEmpty {
                throw APIError.message("Invalid server response: \(snippet)")
            }
            throw APIError.message("Invalid server response.")
        }
    }

    func requestVoid(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        authorized: Bool = true,
        retried: Bool = false
    ) async throws {
        _ = try await requestData(method, path: path, body: body, authorized: authorized, retried: retried)
    }

    private func requestData(
        _ method: String,
        path: String,
        body: Encodable?,
        authorized: Bool,
        retried: Bool
    ) async throws -> Data {
        let url = try resolveURL(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Qadbak-iOS/1.0", forHTTPHeaderField: "User-Agent")
        if authorized, let token = tokenProvider() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost:
                throw APIError.message("No internet connection.")
            case .cannotFindHost, .dnsLookupFailed:
                throw APIError.message("Cannot reach the panel server. Check the panel URL.")
            case .secureConnectionFailed, .serverCertificateUntrusted:
                throw APIError.message("Secure connection failed. Check the panel URL uses https://")
            case .timedOut:
                throw APIError.message("Connection timed out. Try again.")
            default:
                throw APIError.message(error.localizedDescription)
            }
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.message("No response from server.")
        }

        if http.statusCode == 401, authorized, !retried {
            try await refreshHandler()
            return try await requestData(method, path: path, body: body, authorized: authorized, retried: true)
        }

        guard (200 ... 299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIErrorResponse.self, from: data)).flatMap(\.error)
            if http.statusCode == 401, !authorized {
                throw APIError.http(http.statusCode, message ?? "Invalid credentials.")
            }
            if http.statusCode == 401, authorized {
                throw APIError.unauthorized
            }
            if message == nil, let html = String(data: data, encoding: .utf8), html.contains("301 Moved") || html.contains("302 Found") {
                throw APIError.message("Panel URL redirects (e.g. www). Use https://qadbak.com without www.")
            }
            throw APIError.http(http.statusCode, message)
        }
        return data
    }

    private func resolveURL(_ path: String) throws -> URL {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw APIError.message("Invalid API path.")
        }

        if let absolute = URL(string: trimmed), absolute.scheme != nil, absolute.host != nil {
            return absolute
        }

        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.message("Invalid panel URL.")
        }

        if let queryIndex = trimmed.firstIndex(of: "?") {
            let pathPart = String(trimmed[..<queryIndex])
            let queryPart = String(trimmed[trimmed.index(after: queryIndex)...])
            components.path = pathPart.hasPrefix("/") ? pathPart : "/\(pathPart)"
            components.percentEncodedQuery = queryPart
        } else {
            components.path = trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
            components.query = nil
        }
        components.fragment = nil

        guard let url = components.url else {
            throw APIError.message("Invalid API path.")
        }
        return url
    }
}

private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}

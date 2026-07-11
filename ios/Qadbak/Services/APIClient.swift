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
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.message("Invalid API path.")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Qadbak-iOS/1.0", forHTTPHeaderField: "User-Agent")
        if authorized, let token = tokenProvider() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.message("No response from server.")
        }

        if http.statusCode == 401, authorized, !retried {
            try await refreshHandler()
            return try await requestData(method, path: path, body: body, authorized: authorized, retried: true)
        }

        guard (200 ... 299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(APIErrorResponse.self, from: data)).flatMap(\.error)
            if http.statusCode == 401 {
                throw APIError.unauthorized
            }
            throw APIError.http(http.statusCode, message)
        }
        return data
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

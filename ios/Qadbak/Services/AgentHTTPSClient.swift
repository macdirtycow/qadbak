import CryptoKit
import Foundation
import Network
import Security

/// Minimal HTTPS client for the Qadbak agent (self-signed TLS on Tailscale / LAN IPs).
enum AgentHTTPSClient {
    struct Response {
        let statusCode: Int
        let body: Data
    }

    static func request(
        method: String,
        url: URL,
        headers: [String: String] = [:],
        body: Data? = nil,
        pinnedFingerprint: String? = nil,
        timeout: TimeInterval = 90
    ) async throws -> Response {
        guard url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty else {
            throw APIError.message("Agent URL must use https://")
        }
        guard let port = NWEndpoint.Port(rawValue: UInt16(url.port ?? 443)) else {
            throw APIError.message("Invalid agent port.")
        }
        let path = url.path.isEmpty ? "/" : url.path + (url.query.map { "?\($0)" } ?? "")

        let tlsOptions = NWProtocolTLS.Options()
        sec_protocol_options_set_tls_server_name(tlsOptions.securityProtocolOptions, host)
        let pin = pinnedFingerprint?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        sec_protocol_options_set_verify_block(
            tlsOptions.securityProtocolOptions,
            { _, trust, complete in
                if let pin, !pin.isEmpty {
                    complete(secTrustFingerprint(trust) == pin)
                } else {
                    complete(true)
                }
            },
            DispatchQueue.global(qos: .userInitiated)
        )

        let tcpOptions = NWProtocolTCP.Options()
        tcpOptions.enableKeepalive = false
        let parameters = NWParameters(tls: tlsOptions, tcp: tcpOptions)

        let connection = NWConnection(
            host: NWEndpoint.Host(host),
            port: port,
            using: parameters
        )

        return try await withCheckedThrowingContinuation { continuation in
            let task = RequestTask(continuation: continuation)
            let queue = DispatchQueue(label: "com.qadbak.agent-https")
            let responseBuffer = NSMutableData()

            let timer = DispatchWorkItem {
                task.finish(
                    .failure(APIError.message("Agent connection timed out. Confirm Tailscale is enabled on this iPhone.")),
                    connection: connection
                )
            }
            queue.asyncAfter(deadline: .now() + timeout, execute: timer)

            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    var headerLines = [
                        "\(method.uppercased()) \(path) HTTP/1.1",
                        "Host: \(host)",
                        "Accept: application/json",
                        "Connection: close",
                        "User-Agent: Qadbak-iOS/1.0",
                    ]
                    for (key, value) in headers {
                        headerLines.append("\(key): \(value)")
                    }
                    if let body, !body.isEmpty {
                        headerLines.append("Content-Type: application/json")
                        headerLines.append("Content-Length: \(body.count)")
                    } else if method.uppercased() != "GET" && method.uppercased() != "DELETE" {
                        headerLines.append("Content-Length: 0")
                    }
                    var payload = Data((headerLines.joined(separator: "\r\n") + "\r\n\r\n").utf8)
                    if let body { payload.append(body) }

                    connection.send(content: payload, completion: .contentProcessed { error in
                        if let error {
                            task.finish(.failure(error), connection: connection, timer: timer)
                            return
                        }
                        receive(on: connection, into: responseBuffer) { result in
                            switch result {
                            case .success(let data):
                                do {
                                    let parsed = try parseHTTPResponse(data)
                                    task.finish(.success(parsed), connection: connection, timer: timer)
                                } catch {
                                    task.finish(.failure(error), connection: connection, timer: timer)
                                }
                            case .failure(let error):
                                task.finish(.failure(error), connection: connection, timer: timer)
                            }
                        }
                    })
                case .failed(let error):
                    task.finish(
                        .failure(APIError.message("Could not reach agent at \(host):\(port.rawValue) — \(error.localizedDescription). Turn on Tailscale on this iPhone.")),
                        connection: connection,
                        timer: timer
                    )
                case .cancelled:
                    break
                default:
                    break
                }
            }

            connection.start(queue: queue)
        }
    }

    private final class RequestTask: @unchecked Sendable {
        private let lock = NSLock()
        private var finished = false
        private var continuation: CheckedContinuation<Response, Error>?

        init(continuation: CheckedContinuation<Response, Error>) {
            self.continuation = continuation
        }

        func finish(
            _ result: Result<Response, Error>,
            connection: NWConnection,
            timer: DispatchWorkItem? = nil
        ) {
            lock.lock()
            defer { lock.unlock() }
            guard !finished else { return }
            finished = true
            timer?.cancel()
            connection.cancel()
            switch result {
            case .success(let response):
                continuation?.resume(returning: response)
            case .failure(let error):
                continuation?.resume(throwing: error)
            }
            continuation = nil
        }
    }

    private static func receive(
        on connection: NWConnection,
        into buffer: NSMutableData,
        completion: @escaping (Result<Data, Error>) -> Void
    ) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { data, _, isComplete, error in
            if let error {
                completion(.failure(error))
                return
            }
            if let data {
                buffer.append(data)
            }
            if isComplete {
                completion(.success(buffer as Data))
            } else {
                receive(on: connection, into: buffer, completion: completion)
            }
        }
    }

    private static func parseHTTPResponse(_ data: Data) throws -> Response {
        guard let raw = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
            throw APIError.message("Invalid agent response.")
        }
        guard let headerEnd = raw.range(of: "\r\n\r\n") else {
            throw APIError.message("Malformed agent HTTP response.")
        }
        let headerPart = String(raw[..<headerEnd.lowerBound])
        let bodyStart = raw[headerEnd.upperBound...]
        let statusLine = headerPart.split(separator: "\r\n", maxSplits: 1).first.map(String.init) ?? ""
        let statusParts = statusLine.split(separator: " ", omittingEmptySubsequences: true)
        guard statusParts.count >= 2, let code = Int(statusParts[1]) else {
            throw APIError.message("Malformed agent status line.")
        }

        var body = Data(bodyStart.utf8)
        if let contentLength = headerPart
            .split(separator: "\r\n")
            .first(where: { $0.lowercased().hasPrefix("content-length:") })
            .flatMap({ line -> Int? in
                Int(line.split(separator: ":", maxSplits: 1).last?.trimmingCharacters(in: .whitespaces) ?? "")
            }) {
            body = Data(body.prefix(contentLength))
        }
        return Response(statusCode: code, body: body)
    }

    private static func secTrustFingerprint(_ trust: sec_trust_t) -> String? {
        let secTrust = sec_trust_copy_ref(trust).takeRetainedValue()
        guard let chain = SecTrustCopyCertificateChain(secTrust) as? [SecCertificate],
              let cert = chain.first else {
            return nil
        }
        let data = SecCertificateCopyData(cert) as Data
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

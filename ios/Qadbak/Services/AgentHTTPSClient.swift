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
                        "Connection: close",
                        "User-Agent: Qadbak-iOS/1.0",
                    ]
                    if !headers.keys.contains(where: { $0.caseInsensitiveCompare("Accept") == .orderedSame }) {
                        headerLines.append("Accept: application/json")
                    }
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

    static func downloadToFile(
        url: URL,
        headers: [String: String] = [:],
        pinnedFingerprint: String? = nil,
        destination: URL,
        timeout: TimeInterval = 7_200
    ) async throws -> Int {
        let response = try await request(
            method: "GET",
            url: url,
            headers: headers,
            pinnedFingerprint: pinnedFingerprint,
            timeout: timeout
        )
        guard (200 ... 299).contains(response.statusCode) else {
            return response.statusCode
        }
        try response.body.write(to: destination, options: .atomic)
        return response.statusCode
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
        let separator = Data([0x0D, 0x0A, 0x0D, 0x0A])
        guard let headerEnd = data.range(of: separator) else {
            throw APIError.message("Malformed agent HTTP response.")
        }
        let headerData = data[..<headerEnd.lowerBound]
        guard let headerPart = String(data: headerData, encoding: .utf8)
            ?? String(data: headerData, encoding: .isoLatin1) else {
            throw APIError.message("Invalid agent response.")
        }
        let bodyData = data[headerEnd.upperBound...]
        let statusLine = headerPart.split(separator: "\r\n", maxSplits: 1).first.map(String.init) ?? ""
        let statusParts = statusLine.split(separator: " ", omittingEmptySubsequences: true)
        guard statusParts.count >= 2, let code = Int(statusParts[1]) else {
            throw APIError.message("Malformed agent status line.")
        }
        let body = try extractResponseBody(
            headers: parseHeaderFields(headerPart),
            body: Data(bodyData)
        )
        return Response(statusCode: code, body: body)
    }

    private static func parseHeaderFields(_ headerPart: String) -> [String: String] {
        var headers: [String: String] = [:]
        for line in headerPart.split(separator: "\r\n").dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let name = String(line[..<colon]).trimmingCharacters(in: .whitespaces).lowercased()
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            headers[name] = value
        }
        return headers
    }

    private static func extractResponseBody(headers: [String: String], body: Data) throws -> Data {
        if let contentLength = headers["content-length"], let length = Int(contentLength) {
            return Data(body.prefix(length))
        }
        let transferEncoding = headers["transfer-encoding"]?.lowercased() ?? ""
        if transferEncoding.contains("chunked") || looksLikeChunkedBody(body) {
            return try decodeChunkedBody(body)
        }
        return body
    }

    private static func looksLikeChunkedBody(_ body: Data) -> Bool {
        guard let first = body.first else { return false }
        return (first >= UInt8(ascii: "0") && first <= UInt8(ascii: "9"))
            || (first >= UInt8(ascii: "a") && first <= UInt8(ascii: "f"))
            || (first >= UInt8(ascii: "A") && first <= UInt8(ascii: "F"))
    }

    private static func decodeChunkedBody(_ data: Data) throws -> Data {
        var result = Data()
        var index = data.startIndex
        let crlf = Data([0x0D, 0x0A])

        while index < data.endIndex {
            guard let lineEnd = data[index...].range(of: crlf) else { break }
            let sizeLineData = data[index..<lineEnd.lowerBound]
            guard let sizeLine = String(data: sizeLineData, encoding: .utf8) else { break }
            let hexPart = sizeLine.split(separator: ";", maxSplits: 1).first?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard let chunkSize = Int(hexPart, radix: 16), chunkSize >= 0 else {
                throw APIError.message("Malformed agent HTTP response.")
            }
            index = lineEnd.upperBound
            if chunkSize == 0 {
                break
            }
            let chunkEnd = index + chunkSize
            guard chunkEnd <= data.endIndex else {
                throw APIError.message("Malformed agent HTTP response.")
            }
            result.append(data[index..<chunkEnd])
            index = chunkEnd
            if index < data.endIndex, data[index] == 0x0D {
                index = data.index(index, offsetBy: 2, limitedBy: data.endIndex) ?? data.endIndex
            }
        }
        return result
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

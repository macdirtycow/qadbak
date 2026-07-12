import Foundation

enum AgentConfirmedAction {
    static func confirmAndRun(
        client: AgentAPIClient,
        action: String,
        target: String,
        run: (String) async throws -> Void
    ) async throws {
        let token = try await client.requestConfirm(action: action, target: target)
        try await run(token)
    }
}

extension AgentAPIClient {
    func requestConfirm(action: String, target: String) async throws -> String {
        struct Body: Encodable {
            let action: String
            let target: String
        }
        let res: AgentConfirmResponse = try await request(
            "POST",
            path: "/api/v1/actions/confirm",
            body: Body(action: action, target: target)
        )
        guard res.ok != false, let token = res.confirmToken, !token.isEmpty else {
            throw APIError.message(res.error ?? "Could not confirm action.")
        }
        return token
    }

    func fetchUpdates() async throws -> PackageUpdateInfo {
        let res: AgentUpdatesResponse = try await request("GET", path: "/api/v1/updates")
        guard let payload = res.updates else {
            throw APIError.message("Updates unavailable.")
        }
        return payload.toPackageUpdateInfo()
    }

    func installUpdates(confirmToken: String) async throws {
        let _: AgentActionResponse = try await request(
            "POST",
            path: "/api/v1/updates/install",
            confirmToken: confirmToken
        )
    }

    func rebootServer(confirmToken: String) async throws {
        let _: AgentActionResponse = try await request(
            "POST",
            path: "/api/v1/system/reboot",
            confirmToken: confirmToken
        )
    }

    func shutdownServer(confirmToken: String) async throws {
        let _: AgentActionResponse = try await request(
            "POST",
            path: "/api/v1/system/shutdown",
            confirmToken: confirmToken
        )
    }

    func restartService(id: String, confirmToken: String) async throws {
        try await serviceAction(id: id, verb: "restart", confirmToken: confirmToken)
    }

    func startService(id: String, confirmToken: String) async throws {
        try await serviceAction(id: id, verb: "start", confirmToken: confirmToken)
    }

    func stopService(id: String, confirmToken: String) async throws {
        try await serviceAction(id: id, verb: "stop", confirmToken: confirmToken)
    }

    func restartContainer(id: String, confirmToken: String) async throws {
        try await containerAction(id: id, verb: "restart", confirmToken: confirmToken)
    }

    func startContainer(id: String, confirmToken: String) async throws {
        try await containerAction(id: id, verb: "start", confirmToken: confirmToken)
    }

    func stopContainer(id: String, confirmToken: String) async throws {
        try await containerAction(id: id, verb: "stop", confirmToken: confirmToken)
    }

    private func serviceAction(id: String, verb: String, confirmToken: String) async throws {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let _: AgentActionResponse = try await request(
            "POST",
            path: "/api/v1/services/\(encoded)/\(verb)",
            confirmToken: confirmToken
        )
    }

    private func containerAction(id: String, verb: String, confirmToken: String) async throws {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let _: AgentActionResponse = try await request(
            "POST",
            path: "/api/v1/docker/containers/\(encoded)/\(verb)",
            confirmToken: confirmToken
        )
    }

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        confirmToken: String? = nil,
        authorized: Bool = true,
        retried: Bool = false
    ) async throws -> T {
        let data = try await requestData(
            method,
            path: path,
            body: body,
            confirmToken: confirmToken,
            authorized: authorized,
            retried: retried
        )
        return try JSONDecoder().decode(T.self, from: data)
    }
}

import Foundation

@MainActor
enum ServerProviderFactory {
    static func makeProvider(
        for server: ManagedServer,
        api: QadbakAPI?,
        agentClient: AgentAPIClient?,
        keychain: KeychainStore
    ) -> (any ServerManagementProvider)? {
        switch server.authenticationMethod {
        case .qadbakMobileAuth:
            guard let api else { return nil }
            return QadbakPanelProvider(server: server, api: api)
        case .agentToken:
            guard let agentClient else { return nil }
            return QadbakAgentProvider(server: server, client: agentClient)
        case .agentTokenPendingPair:
            return nil
        }
    }
}

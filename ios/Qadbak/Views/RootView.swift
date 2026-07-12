import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.showsAgentPanelShell {
                AgentServerShellView()
            } else if appState.showsDomainHosting {
                DomainListView()
            } else if appState.showsAgentDashboard {
                NavigationStack {
                    AgentServerDashboardView()
                }
            } else if appState.savedServers.isEmpty && appState.addServerMode == nil {
                NavigationStack {
                    AddServerChoiceView(presentation: .onboarding)
                }
            } else {
                LoginView(showBackToChoice: appState.savedServers.isEmpty)
            }
        }
        .tint(QadbakPalette.accent)
        .preferredColorScheme(.dark)
    }
}

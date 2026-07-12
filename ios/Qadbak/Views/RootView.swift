import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.showsDomainHosting {
                DomainListView()
            } else if appState.showsAgentDashboard {
                NavigationStack {
                    AgentServerDashboardView()
                }
            } else {
                LoginView()
            }
        }
        .tint(QadbakPalette.accent)
        .preferredColorScheme(.dark)
    }
}

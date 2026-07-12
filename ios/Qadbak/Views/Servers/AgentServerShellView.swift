import SwiftUI

/// Tab shell for Linux agent servers with linked external panels (Hestia domains and/or Coolify/CasaOS apps).
struct AgentServerShellView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        TabView {
            if appState.activeServer?.capabilities.domainHosting == true {
                DomainListView()
                    .tabItem {
                        Label("Domains", systemImage: "globe")
                    }
            }
            if appState.activeServer?.capabilities.panelApps == true {
                NavigationStack {
                    PanelAppsView()
                }
                .tabItem {
                    Label("Apps", systemImage: "shippingbox")
                }
            }
            NavigationStack {
                AgentServerDashboardView()
            }
            .tabItem {
                Label("Server", systemImage: "server.rack")
            }
        }
        .tint(QadbakPalette.accent)
    }
}

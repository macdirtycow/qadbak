import SwiftUI

@main
struct QadbakApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .onAppear {
                    PushNotificationService.shared.configure(
                        apiProvider: { appState.api },
                        appStateProvider: { appState }
                    )
                    AgentHealthMonitor.shared.start(appState: appState)
                }
                .task {
                    await PushNotificationService.shared.requestAuthorizationAndRegister()
                    if appState.isSignedIn || appState.showsAgentDashboard {
                        await appState.refreshSessionInfo()
                    }
                }
        }
    }
}

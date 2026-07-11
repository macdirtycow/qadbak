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
                }
                .task {
                    if appState.isSignedIn {
                        await appState.refreshSessionInfo()
                    }
                }
        }
    }
}

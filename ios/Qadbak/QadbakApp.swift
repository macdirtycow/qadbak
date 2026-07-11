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
                    PushNotificationService.shared.configure { appState.api }
                }
                .task {
                    if appState.isSignedIn {
                        await appState.refreshSessionInfo()
                    }
                }
        }
    }
}

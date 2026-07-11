import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if appState.isSignedIn && appState.requiresUnlock {
                AppLockView {
                    appState.unlock()
                }
            } else if appState.isSignedIn {
                DomainListView()
            } else {
                LoginView()
            }
        }
        .tint(QadbakPalette.accent)
        .preferredColorScheme(.dark)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background && appState.isSignedIn {
                appState.lock()
            }
        }
    }
}

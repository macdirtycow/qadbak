import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isLoading && !appState.isSignedIn {
                ProgressView("Connecting…")
            } else if appState.isSignedIn {
                DomainListView()
            } else {
                LoginView()
            }
        }
        .tint(QadbakTheme.accent)
    }
}

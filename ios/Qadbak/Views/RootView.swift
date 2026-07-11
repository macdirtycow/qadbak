import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isSignedIn {
                DomainListView()
            } else {
                LoginView()
            }
        }
        .tint(QadbakPalette.accent)
        .preferredColorScheme(.dark)
    }
}

import SwiftUI

struct AppLockView: View {
    let onUnlock: () -> Void

    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "faceid")
                    .font(.system(size: 56))
                    .foregroundStyle(QadbakPalette.accent)
                Text("Qadbak is locked")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(QadbakPalette.text)
                Text("Use Face ID or your device passcode to continue.")
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.muted)
                    .multilineTextAlignment(.center)
                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.danger)
                }
                QBPrimaryButton(title: "Unlock") {
                    Task { await unlock() }
                }
            }
            .padding(32)
        }
        .task { await unlock() }
        .preferredColorScheme(.dark)
    }

    private func unlock() async {
        let ok = await BiometricGate.authenticate(reason: "Unlock Qadbak")
        if ok {
            errorMessage = nil
            onUnlock()
        } else {
            errorMessage = "Authentication failed. Try again."
        }
    }
}

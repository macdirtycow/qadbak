import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var serverURL = ""
    @State private var username = ""
    @State private var password = ""
    @State private var totpCode = ""
    @State private var totpLoginToken = ""
    @State private var showTotp = false
    @State private var localError: String?
    @State private var connectionStatus: String?

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 14) {
                        QadbakLogoMark(size: 64)
                        Text("Qadbak")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(QadbakPalette.text)
                        Text("Manage your domains from iPhone and iPad — like Jellyfin, but for hosting.")
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(QadbakPalette.muted)
                            .padding(.horizontal, 8)
                    }
                    .padding(.top, 24)

                    QBGlassCard {
                        VStack(alignment: .leading, spacing: 18) {
                            QBScreenHeader(
                                title: showTotp ? "Two-factor" : "Sign in",
                                subtitle: showTotp
                                    ? "Enter the 6-digit code from your authenticator app."
                                    : "Connect to your panel server, then sign in."
                            )

                            if !showTotp {
                                QBTextField(
                                    label: "Panel URL",
                                    placeholder: "https://qadbak.com",
                                    text: $serverURL,
                                    keyboard: .URL
                                )
                                Text("Use https://qadbak.com — no www, no /login.")
                                    .font(.caption)
                                    .foregroundStyle(QadbakPalette.muted)
                                if let url = appState.serverURL {
                                    Text("Saved: \(url.absoluteString)")
                                        .font(.caption)
                                        .foregroundStyle(QadbakPalette.muted)
                                }
                                if let connectionStatus {
                                    Text(connectionStatus)
                                        .font(.caption)
                                        .foregroundStyle(QadbakPalette.muted)
                                }
                                QBTextField(label: "Username", placeholder: "admin", text: $username)
                                QBTextField(label: "Password", placeholder: "••••••••", text: $password, secure: true)
                            } else {
                                QBTextField(
                                    label: "Authenticator code",
                                    placeholder: "123456",
                                    text: $totpCode,
                                    keyboard: .numberPad
                                )
                                Button("Use a different account") {
                                    showTotp = false
                                    totpCode = ""
                                    totpLoginToken = ""
                                    localError = nil
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(QadbakPalette.accent)
                            }

                            if let localError {
                                ErrorBanner(message: localError)
                            }

                            QBPrimaryButton(
                                title: showTotp ? "Verify & continue" : "Sign in",
                                loading: appState.isLoading,
                                disabled: !canSubmit
                            ) {
                                Task { await submit() }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if serverURL.isEmpty, let saved = appState.serverURL?.absoluteString {
                serverURL = saved
            } else if !serverURL.isEmpty {
                if let normalized = try? AppState.normalizePanelURL(serverURL) {
                    serverURL = normalized.absoluteString
                }
            }
            if username.isEmpty, let saved = KeychainStore().loadUsername() {
                username = saved
            }
        }
    }

    private var canSubmit: Bool {
        if showTotp { return totpCode.count >= 6 }
        return !username.isEmpty && !password.isEmpty && !serverURL.isEmpty
    }

    private func submit() async {
        localError = nil
        connectionStatus = nil
        do {
            try appState.configureServer(serverURL)
            if !showTotp {
                connectionStatus = try await appState.checkPanelConnection()
            }
            if showTotp {
                try await appState.completeTotp(loginToken: totpLoginToken, code: totpCode)
            } else {
                try await appState.login(username: username, password: password)
            }
        } catch let err as APIError {
            switch err {
            case .totpRequired(let token):
                totpLoginToken = token
                showTotp = true
                totpCode = ""
                password = ""
                localError = nil
                connectionStatus = "Password accepted — enter your 2FA code."
            default:
                localError = err.localizedDescription
            }
        } catch {
            localError = error.localizedDescription
        }
    }
}

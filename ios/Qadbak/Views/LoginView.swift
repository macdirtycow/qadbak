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

    var body: some View {
        NavigationStack {
            Form {
                Section("Panel server") {
                    TextField("https://panel.example.com", text: $serverURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    if let url = appState.serverURL {
                        Text(url.absoluteString)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if showTotp {
                    Section("Two-factor code") {
                        TextField("6-digit code", text: $totpCode)
                            .keyboardType(.numberPad)
                    }
                } else {
                    Section("Account") {
                        TextField("Username", text: $username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Password", text: $password)
                    }
                }

                if let localError {
                    Section {
                        ErrorBanner(message: localError)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    Button(showTotp ? "Verify & sign in" : "Sign in") {
                        Task { await submit() }
                    }
                    .disabled(appState.isLoading || !canSubmit)
                }
            }
            .navigationTitle("Qadbak")
            .onAppear {
                if serverURL.isEmpty, let saved = appState.serverURL?.absoluteString {
                    serverURL = saved
                }
                if username.isEmpty, let saved = KeychainStore().loadUsername() {
                    username = saved
                }
            }
        }
    }

    private var canSubmit: Bool {
        if showTotp {
            return totpCode.count >= 6
        }
        return !username.isEmpty && !password.isEmpty && !serverURL.isEmpty
    }

    private func submit() async {
        localError = nil
        do {
            try appState.configureServer(serverURL)
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
                password = ""
            default:
                localError = err.localizedDescription
            }
        } catch {
            localError = error.localizedDescription
        }
    }
}

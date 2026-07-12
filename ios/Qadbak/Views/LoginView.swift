import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var serverURL = ""
    @State private var serverLabel = ""
    @State private var username = ""
    @State private var password = ""
    @State private var totpCode = ""
    @State private var totpLoginToken = ""
    @State private var showTotp = false
    @State private var localError: String?
    @State private var connectionStatus: String?
    @State private var showServerSwitcher = false

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 14) {
                        QadbakLogoMark(size: 64)
                        Text("Qadbak")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(QadbakPalette.text)
                        Text("Manage test and production panels — switch servers in one tap.")
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(QadbakPalette.muted)
                            .padding(.horizontal, 8)
                    }
                    .padding(.top, 24)

                    if !appState.savedServers.isEmpty {
                        savedServersSection
                    }

                    QBGlassCard {
                        VStack(alignment: .leading, spacing: 18) {
                            QBScreenHeader(
                                title: showTotp ? "Two-factor" : "Sign in",
                                subtitle: showTotp
                                    ? "Enter the 6-digit code from your authenticator app."
                                    : appState.addingNewServer
                                        ? "Add a new panel server. Sessions are stored in the Keychain."
                                        : "Connect to your panel server, then sign in."
                            )

                            if !showTotp {
                                QBTextField(
                                    label: "Server label (optional)",
                                    placeholder: "Production",
                                    text: $serverLabel
                                )
                                QBTextField(
                                    label: "Panel URL",
                                    placeholder: "https://qadbak.com",
                                    text: $serverURL,
                                    keyboard: .URL
                                )
                                Text("Use https://qadbak.com — no www, no /login.")
                                    .font(.caption)
                                    .foregroundStyle(QadbakPalette.muted)
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
        .sheet(isPresented: $showServerSwitcher) {
            ServerSwitcherView()
        }
        .onAppear {
            prefillFromActiveServer()
        }
        .onChange(of: appState.activeServerId) { _, _ in
            prefillFromActiveServer()
        }
    }

    private var savedServersSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your servers")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(QadbakPalette.muted)
                    .textCase(.uppercase)
                Spacer()
                Button("Manage") { showServerSwitcher = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(QadbakPalette.accent)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(appState.savedServers) { server in
                        Button {
                            Task { await quickSwitch(server) }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(server.displayName)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(QadbakPalette.text)
                                Text(server.displayHost)
                                    .font(.caption2)
                                    .foregroundStyle(QadbakPalette.muted)
                                if appState.hasStoredSession(for: server) {
                                    Label("Keychain", systemImage: "lock.shield")
                                        .font(.caption2)
                                        .foregroundStyle(QadbakPalette.success)
                                }
                            }
                            .padding(12)
                            .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay {
                                if appState.activeServerId == server.id {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(QadbakPalette.glow.opacity(0.5), lineWidth: 1)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    Button {
                        Task { await appState.prepareAddServer() }
                        serverURL = ""
                        serverLabel = ""
                        username = ""
                        password = ""
                    } label: {
                        Label("Add", systemImage: "plus")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(QadbakPalette.accent)
                            .padding(12)
                            .background(QadbakPalette.card.opacity(0.7), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var canSubmit: Bool {
        if showTotp { return totpCode.count >= 6 }
        return !username.isEmpty && !password.isEmpty && !serverURL.isEmpty
    }

    private func prefillFromActiveServer() {
        if let server = appState.activeServer, server.isQadbakPanel {
            if serverURL.isEmpty || !appState.addingNewServer {
                serverURL = server.apiBaseURL
                serverLabel = server.displayName
            }
            if username.isEmpty, let saved = server.username {
                username = saved
            }
        } else if serverURL.isEmpty, let saved = appState.serverURL?.absoluteString {
            serverURL = saved
        }
        if !serverURL.isEmpty, let normalized = try? AppState.normalizePanelURL(serverURL) {
            serverURL = normalized.absoluteString
        }
    }

    private func quickSwitch(_ server: ManagedServer) async {
        localError = nil
        do {
            try await appState.switchToServer(server)
        } catch {
            appState.activeServerId = server.id
            if server.isQadbakPanel {
                serverURL = server.apiBaseURL
                serverLabel = server.displayName
                username = server.username ?? ""
            }
            localError = error.localizedDescription
        }
    }

    private func submit() async {
        localError = nil
        connectionStatus = nil
        do {
            try appState.configureServer(serverURL)
            if !showTotp {
                connectionStatus = try await appState.checkPanelConnection()
            }
            let label = serverLabel.trimmingCharacters(in: .whitespacesAndNewlines)
            if showTotp {
                try await appState.completeTotp(
                    loginToken: totpLoginToken,
                    code: totpCode,
                    serverLabel: label.nilIfEmpty
                )
            } else {
                try await appState.login(
                    username: username,
                    password: password,
                    serverLabel: label.nilIfEmpty
                )
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

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

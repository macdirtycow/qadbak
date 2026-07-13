import SwiftUI

struct PanelLinkView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let server: ManagedServer
    let panel: ServerKind
    let onLinked: () async -> Void

    @State private var baseURL = ""
    @State private var username = ""
    @State private var password = ""
    @State private var accessKey = ""
    @State private var secretKey = ""
    @State private var apiToken = ""
    @State private var useAccessKey = false
    @State private var canAutoSetup = false
    @State private var isSaving = false
    @State private var isAutoSettingUp = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(helpText)
                        .font(.footnote)
                        .foregroundStyle(QadbakPalette.muted)
                }

                if panel == .hestiaCP, canAutoSetup {
                    Section {
                        Button {
                            Task { await autoSetupAndLink() }
                        } label: {
                            HStack {
                                Text("Set up automatically")
                                Spacer()
                                if isAutoSettingUp {
                                    ProgressView().controlSize(.small)
                                }
                            }
                        }
                        .disabled(isAutoSettingUp || isSaving)
                        Text("Creates a Hestia API key on this server, whitelists localhost, and links the panel.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)
                    }
                }

                if showsBaseURL {
                    Section("Panel URL") {
                        TextField(defaultBasePlaceholder, text: $baseURL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                        if panel == .hestiaCP {
                            Text("Leave empty to use \(defaultBasePlaceholder) on this server.")
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.muted)
                        }
                    }
                }

                credentialFields

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(QadbakPalette.danger)
                    }
                }
            }
            .navigationTitle("Link \(panel.displayName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Link") { Task { await save() } }
                        .disabled(isSaving || isAutoSettingUp || !canSave)
                }
            }
            .task { await loadSetupHints() }
            .preferredColorScheme(.dark)
        }
    }

    @ViewBuilder
    private var credentialFields: some View {
        switch panel {
        case .hestiaCP:
            Section("Hestia API") {
                Toggle("Use access key (recommended)", isOn: $useAccessKey)
                if useAccessKey {
                    TextField("Access key", text: $accessKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Secret key", text: $secretKey)
                } else {
                    TextField("Admin username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                }
            }
        case .coolify:
            Section("Coolify API") {
                SecureField("API token", text: $apiToken)
                Text("Create a token in Coolify → Keys & Tokens → API tokens.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        case .casaOS:
            Section("CasaOS API") {
                SecureField("API token (optional)", text: $apiToken)
                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                Text("Use a token from CasaOS settings, or your login username and password.")
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        default:
            EmptyView()
        }
    }

    private var helpText: String {
        switch panel {
        case .hestiaCP:
            return "Credentials stay on your server inside the Qadbak agent. Use automatic setup, or paste an existing Hestia access key."
        case .coolify:
            return "The agent calls the Coolify API on localhost. Deploy, start, and stop apps from the Apps tab."
        case .casaOS:
            return "The agent reads installed apps from CasaOS. View them in the Apps tab; installs stay in the CasaOS UI."
        default:
            return ""
        }
    }

    private var showsBaseURL: Bool { true }

    private var defaultBasePlaceholder: String {
        switch panel {
        case .hestiaCP: return "https://127.0.0.1:8083"
        case .coolify: return "http://127.0.0.1:8000"
        case .casaOS: return "http://127.0.0.1"
        default: return "http://127.0.0.1"
        }
    }

    private var canSave: Bool {
        switch panel {
        case .hestiaCP:
            if useAccessKey {
                return !accessKey.trimmingCharacters(in: .whitespaces).isEmpty
                    && !secretKey.isEmpty
            }
            return !username.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
        case .coolify:
            return !apiToken.trimmingCharacters(in: .whitespaces).isEmpty
        case .casaOS:
            let token = apiToken.trimmingCharacters(in: .whitespaces)
            if !token.isEmpty { return true }
            return !username.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
        default:
            return false
        }
    }

    private func loadSetupHints() async {
        guard panel == .hestiaCP, server.isAgentManaged else { return }
        guard let client = appState.makeAgentClient(for: server) else { return }
        useAccessKey = true
        if baseURL.isEmpty {
            baseURL = defaultBasePlaceholder
        }
        do {
            let res = try await client.hestiaSetup()
            if let setup = res.hestiaSetup {
                canAutoSetup = setup.canAutoSetup == true
                if let url = setup.defaultBaseUrl, !url.isEmpty, baseURL == defaultBasePlaceholder {
                    baseURL = url
                }
                if setup.recommendedAuth == "accessKey" {
                    useAccessKey = true
                }
            }
        } catch {
            // Non-fatal; manual entry still works.
        }
    }

    private func autoSetupAndLink() async {
        isAutoSettingUp = true
        errorMessage = nil
        defer { isAutoSettingUp = false }

        guard let client = appState.makeAgentClient(for: server) else {
            errorMessage = "Agent session not available."
            return
        }

        do {
            let res = try await client.hestiaBootstrap(autoLink: true)
            guard res.ok != false else {
                errorMessage = res.error ?? "Automatic Hestia setup failed."
                if let key = res.accessKey, let secret = res.secretKey {
                    accessKey = key
                    secretKey = secret
                    useAccessKey = true
                }
                if let url = res.baseUrl, !url.isEmpty {
                    baseURL = url
                }
                return
            }
            if res.linked == true {
                await applyLinkedCapabilities(res.capabilities)
                await onLinked()
                dismiss()
                return
            }
            if let key = res.accessKey, let secret = res.secretKey {
                accessKey = key
                secretKey = secret
                useAccessKey = true
            }
            if let url = res.baseUrl, !url.isEmpty {
                baseURL = url
            }
            await save()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let trimmedBase = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = PanelLinkRequest(
            panel: panel.rawValue,
            baseUrl: trimmedBase.isEmpty ? nil : trimmedBase,
            username: username.trimmingCharacters(in: .whitespaces).isEmpty ? nil : username.trimmingCharacters(in: .whitespaces),
            password: password.isEmpty ? nil : password,
            accessKey: accessKey.trimmingCharacters(in: .whitespaces).isEmpty ? nil : accessKey.trimmingCharacters(in: .whitespaces),
            secretKey: secretKey.isEmpty ? nil : secretKey,
            apiToken: apiToken.trimmingCharacters(in: .whitespaces).isEmpty ? nil : apiToken.trimmingCharacters(in: .whitespaces)
        )

        do {
            guard let client = appState.makeAgentClient(for: server) else {
                errorMessage = "Agent session not available."
                return
            }
            let res = try await client.linkPanel(request)
            if res.ok != true {
                errorMessage = res.error ?? "Could not link panel."
                return
            }
            await applyLinkedCapabilities(res.capabilities)
            await onLinked()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func applyLinkedCapabilities(_ caps: AgentCapabilitiesPayload?) async {
        if let caps {
            var updated = server
            updated.capabilities = caps.toServerCapabilities()
            if panel == .hestiaCP {
                updated.serverKind = .hestiaCP
            }
            appState.updateServerProfileIfExists(updated)
            if appState.activeServerId == server.id {
                await appState.refreshActiveServerCapabilities()
            }
        } else {
            await appState.refreshActiveServerCapabilities()
        }
    }
}

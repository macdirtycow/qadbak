import SwiftUI

struct DomainTerminalView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    var adminShell = false

    @State private var terminalController: TerminalWebViewController?
    @State private var session: TerminalSessionInfo?
    @State private var webReady = false
    @State private var statusText = "Connecting…"
    @State private var isConnected = false
    @State private var errorMessage: String?
    @State private var inputBuffer = ""
    @State private var ctrlActive = false
    @State private var altActive = false
    @FocusState private var keyboardFocused: Bool
    @State private var refreshTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            statusBar
            if let errorMessage, !isConnected {
                ErrorBanner(message: errorMessage)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
            }
            TerminalWebView { controller in
                terminalController = controller
                controller.statusHandler = { state, detail in
                    Task { @MainActor in
                        handleStatus(state, detail: detail)
                    }
                }
                webReady = true
                openTerminalIfReady()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture {
                terminalController?.focus()
                keyboardFocused = true
            }

            if keyboardFocused {
                HStack {
                    TextField("Type command…", text: $inputBuffer)
                        .textFieldStyle(.roundedBorder)
                        .font(.body.monospaced())
                        .submitLabel(.send)
                        .focused($keyboardFocused)
                        .onSubmit { sendInputBuffer() }
                    Button("Send") { sendInputBuffer() }
                        .buttonStyle(.borderedProminent)
                        .tint(QadbakPalette.accent)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
            }

            TermuxExtraKeysView(ctrlActive: $ctrlActive, altActive: $altActive) { key in
                terminalController?.sendKey(key)
            }
        }
        .background(QadbakPalette.bg)
        .navigationTitle(adminShell ? "Server shell" : "Terminal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Show keyboard") { keyboardFocused = true }
                    Button("Focus terminal") { terminalController?.focus() }
                    Button("Reconnect") { Task { await connect() } }
                    Button("Disconnect", role: .destructive) {
                        stopRefreshLoop()
                        terminalController?.disconnect()
                        isConnected = false
                        statusText = "Disconnected"
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .task { await connect() }
        .onDisappear {
            stopRefreshLoop()
            terminalController?.disconnect()
        }
        .preferredColorScheme(.dark)
    }

    private var statusBar: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isConnected ? QadbakPalette.success : QadbakPalette.warning)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(0)
            Spacer(minLength: 8)
            if ctrlActive || altActive {
                HStack(spacing: 4) {
                    if ctrlActive {
                        Text("CTRL").font(.caption2.weight(.bold)).foregroundStyle(QadbakPalette.accent)
                    }
                    if altActive {
                        Text("ALT").font(.caption2.weight(.bold)).foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
            if let user = session?.unixUser ?? session?.shellUser {
                Text(user)
                    .font(.caption.monospaced())
                    .foregroundStyle(QadbakPalette.accent)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(QadbakPalette.card.opacity(0.6))
    }

    private func sendInputBuffer() {
        guard !inputBuffer.isEmpty else { return }
        terminalController?.sendText(inputBuffer + "\r")
        inputBuffer = ""
    }

    private struct ModifierState: Decodable {
        let ctrl: Bool
        let alt: Bool
    }

    private func handleStatus(_ state: String, detail: String?) {
        switch state {
        case "connected":
            isConnected = true
            statusText = adminShell ? "Connected to server shell" : "Connected · \(domainName)"
            errorMessage = nil
            terminalController?.fit()
            startRefreshLoop()
        case "closed":
            isConnected = false
            stopRefreshLoop()
            statusText = detail?.isEmpty == false ? "Session closed (\(detail!))" : "Session closed"
        case "error":
            isConnected = false
            stopRefreshLoop()
            statusText = detail ?? "Terminal error"
            errorMessage = detail
        case "modifiers":
            if let detail,
               let data = detail.data(using: .utf8),
               let mods = try? JSONDecoder().decode(ModifierState.self, from: data) {
                ctrlActive = mods.ctrl
                altActive = mods.alt
            }
        case "ready":
            webReady = true
            openTerminalIfReady()
        default:
            break
        }
    }

    private func startRefreshLoop() {
        stopRefreshLoop()
        refreshTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(90))
                guard !Task.isCancelled, isConnected else { break }
                await refreshSession()
            }
        }
    }

    private func stopRefreshLoop() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    private func refreshSession() async {
        guard let api = appState.api, isConnected else { return }
        do {
            let info = adminShell
                ? try await api.adminTerminalSession()
                : try await api.domainTerminalSession(domainName)
            guard info.available == true else { return }
            session = info
            terminalController?.connect(session: info)
        } catch {
            // Keep existing session; token refresh is best-effort.
        }
    }

    private func openTerminalIfReady() {
        guard webReady,
              let info = session,
              info.available == true,
              let controller = terminalController else { return }
        statusText = "Opening terminal…"
        controller.connect(session: info)
    }

    private func connect() async {
        guard let api = appState.api else { return }
        stopRefreshLoop()
        statusText = "Fetching session…"
        errorMessage = nil
        isConnected = false
        do {
            let info: TerminalSessionInfo
            if adminShell {
                info = try await api.adminTerminalSession()
            } else {
                info = try await api.domainTerminalSession(domainName)
            }
            session = info
            if info.available != true {
                statusText = info.error ?? "Terminal unavailable"
                errorMessage = info.error ?? "Terminal is disabled on this server."
                return
            }
            if info.backendReady == false {
                errorMessage = "Terminal backend is not running. Try Repair on the server."
            }
            openTerminalIfReady()
        } catch {
            statusText = error.localizedDescription
            errorMessage = error.localizedDescription
        }
    }
}

extension TerminalSessionInfo: Encodable {
    enum CodingKeys: String, CodingKey {
        case available, backendReady, token, wsUrl, wsProtocols, unixUser, shellUser, domain, error
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(available, forKey: .available)
        try c.encodeIfPresent(backendReady, forKey: .backendReady)
        try c.encodeIfPresent(token, forKey: .token)
        try c.encodeIfPresent(wsUrl, forKey: .wsUrl)
        try c.encodeIfPresent(wsProtocols, forKey: .wsProtocols)
        try c.encodeIfPresent(unixUser, forKey: .unixUser)
        try c.encodeIfPresent(shellUser, forKey: .shellUser)
        try c.encodeIfPresent(domain, forKey: .domain)
        try c.encodeIfPresent(error, forKey: .error)
    }
}

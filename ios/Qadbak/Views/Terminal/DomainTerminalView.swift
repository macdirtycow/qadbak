import SwiftUI

struct DomainTerminalView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    var adminShell = false

    @State private var terminalController: TerminalWebViewController?
    @State private var session: TerminalSessionInfo?
    @State private var statusText = "Connecting…"
    @State private var isConnected = false
    @State private var errorMessage: String?
    @State private var inputBuffer = ""
    @FocusState private var keyboardFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            statusBar
            TerminalWebView { controller in
                terminalController = controller
                controller.statusHandler = { state, detail in
                    Task { @MainActor in
                        handleStatus(state, detail: detail)
                    }
                }
                if let session {
                    controller.connect(session: session)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if keyboardFocused {
                HStack {
                    TextField("Type command…", text: $inputBuffer)
                        .textFieldStyle(.roundedBorder)
                        .font(.body.monospaced())
                        .submitLabel(.send)
                        .onSubmit { sendInputBuffer() }
                    Button("Send") { sendInputBuffer() }
                        .buttonStyle(.borderedProminent)
                        .tint(QadbakPalette.accent)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
            }

            TermuxExtraKeysView { key in
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
                    Button("Reconnect") { Task { await connect() } }
                    Button("Disconnect", role: .destructive) {
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
        .onDisappear { terminalController?.disconnect() }
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
            Spacer()
            if let user = session?.unixUser ?? session?.shellUser {
                Text(user)
                    .font(.caption.monospaced())
                    .foregroundStyle(QadbakPalette.accent)
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

    private func handleStatus(_ state: String, detail: String?) {
        switch state {
        case "connected":
            isConnected = true
            statusText = adminShell ? "Connected to server shell" : "Connected · \(domainName)"
            errorMessage = nil
            terminalController?.fit()
        case "closed":
            isConnected = false
            statusText = "Session closed"
        case "error":
            isConnected = false
            statusText = detail ?? "Terminal error"
            errorMessage = detail
        case "ready":
            if let session { terminalController?.connect(session: session) }
        default:
            break
        }
    }

    private func connect() async {
        guard let api = appState.api else { return }
        statusText = "Fetching session…"
        errorMessage = nil
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
                errorMessage = info.error
                return
            }
            terminalController?.connect(session: info)
        } catch {
            statusText = error.localizedDescription
            errorMessage = error.localizedDescription
        }
    }
}

// Make TerminalSessionInfo Encodable for JS bridge
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

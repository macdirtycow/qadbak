import SwiftUI

struct ServerSwitcherView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var errorMessage: String?
    @State private var switchingId: String?
    @State private var showAddServer = false

    var body: some View {
        NavigationStack {
            ZStack {
                QadbakPalette.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let errorMessage {
                            ErrorBanner(message: errorMessage)
                        }
                        Text("Tap a server to switch instantly. Tokens stay in the secure Keychain.")
                            .font(.caption)
                            .foregroundStyle(QadbakPalette.muted)

                        ForEach(appState.savedServers) { server in
                            serverRow(server)
                        }

                        Button {
                            showAddServer = true
                        } label: {
                            Label("Add server", systemImage: "plus.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(QadbakPalette.accent)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Servers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
            .sheet(isPresented: $showAddServer) {
                NavigationStack {
                    AddServerChoiceView()
                }
                .preferredColorScheme(.dark)
            }
            .preferredColorScheme(.dark)
        }
    }

    private func serverRow(_ server: ManagedServer) -> some View {
        let isActive = appState.activeServerId == server.id
        let isSwitching = switchingId == server.id
        return Button {
            Task { await switchServer(server) }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(isActive ? QadbakPalette.glow.opacity(0.25) : QadbakPalette.border.opacity(0.35))
                        .frame(width: 40, height: 40)
                    Image(systemName: isActive ? "checkmark.circle.fill" : "server.rack")
                        .foregroundStyle(isActive ? QadbakPalette.glow : QadbakPalette.muted)
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(server.displayName)
                            .font(.headline)
                            .foregroundStyle(QadbakPalette.text)
                        ServerBadgeView(server: server)
                    }
                    Text(server.subtitle)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                    if appState.hasStoredSession(for: server) {
                        Label("Saved session", systemImage: "lock.shield.fill")
                            .font(.caption2)
                            .foregroundStyle(QadbakPalette.success)
                    } else if server.isQadbakPanel {
                        Label("Sign in required", systemImage: "key.fill")
                            .font(.caption2)
                            .foregroundStyle(QadbakPalette.warning)
                    } else {
                        Label("Pairing required", systemImage: "link")
                            .font(.caption2)
                            .foregroundStyle(QadbakPalette.warning)
                    }
                }
                Spacer()
                if isSwitching {
                    ProgressView().tint(QadbakPalette.accent)
                }
            }
            .padding(14)
            .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isActive ? QadbakPalette.glow.opacity(0.6) : Color.clear, lineWidth: 1.5)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Remove server", role: .destructive) {
                Task { await appState.removeServer(server) }
            }
        }
    }

    private func switchServer(_ server: ManagedServer) async {
        switchingId = server.id
        errorMessage = nil
        defer { switchingId = nil }
        do {
            try await appState.switchToServer(server)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

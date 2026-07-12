import SwiftUI

struct AgentLogsView: View {
    @Environment(AppState.self) private var appState

    @State private var logSource = "journal"
    @State private var serviceFilter = ""
    @State private var lines: [String] = []
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            VStack(spacing: 0) {
                controls
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)

                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                }

                if isLoading && lines.isEmpty {
                    QBLoadingState(message: "Loading logs…")
                } else if lines.isEmpty {
                    QBEmptyState(title: "No log lines", message: "Nothing returned for this source.", icon: "doc.text")
                } else {
                    ScrollView {
                        ScrollViewReader { proxy in
                            Text(lines.joined(separator: "\n"))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(QadbakPalette.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(16)
                                .id("log-bottom")
                                .onAppear { proxy.scrollTo("log-bottom", anchor: .bottom) }
                        }
                    }
                    .background(QadbakPalette.card)
                }

                if nextCursor != nil {
                    Button("Load older") {
                        Task { await load(append: true) }
                    }
                    .buttonStyle(.bordered)
                    .tint(QadbakPalette.accent)
                    .padding()
                }
            }
        }
        .navigationTitle("Logs")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load(append: false) }
        .task { await load(append: false) }
        .preferredColorScheme(.dark)
    }

    private var controls: some View {
        VStack(spacing: 12) {
            Picker("Source", selection: $logSource) {
                Text("System journal").tag("journal")
                Text("Service unit").tag("service")
            }
            .pickerStyle(.segmented)
            .onChange(of: logSource) { _, _ in
                lines = []
                nextCursor = nil
                Task { await load(append: false) }
            }

            if logSource == "service" {
                QBTextField(
                    label: "Service unit",
                    placeholder: "nginx.service",
                    text: $serviceFilter,
                    keyboard: .URL
                )
                .onSubmit { Task { await load(append: false) } }
            }
        }
    }

    private func load(append: Bool) async {
        guard let provider = appState.activeProvider as? QadbakAgentProvider else { return }
        isLoading = true
        if !append { errorMessage = nil }
        defer { isLoading = false }

        let source: String
        if logSource == "service" {
            let trimmed = serviceFilter.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                errorMessage = "Enter a service unit name."
                return
            }
            source = trimmed
        } else {
            source = "journal"
        }

        do {
            let page: ManagedLogPage
            if append, let cursor = nextCursor {
                page = try await provider.fetchOlderLogs(source: source, cursor: cursor)
            } else {
                page = try await provider.fetchLogs(source: source, cursor: nil)
            }
            if append {
                lines.insert(contentsOf: page.lines, at: 0)
            } else {
                lines = page.lines
            }
            nextCursor = page.nextCursor?.isEmpty == false ? page.nextCursor : nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

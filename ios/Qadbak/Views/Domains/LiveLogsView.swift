import SwiftUI

struct LiveLogsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var logType = "access"
    @State private var logText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var autoRefresh = true

    private let timer = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                Picker("Log type", selection: $logType) {
                    Text("Access").tag("access")
                    Text("Error").tag("error")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .onChange(of: logType) { _, _ in
                    Task { await load() }
                }

                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                }

                if isLoading && logText.isEmpty {
                    QBLoadingState(message: "Loading logs…")
                } else if logText.isEmpty {
                    QBEmptyState(title: "No log lines", message: "Nothing returned for this log type.", icon: "doc.text")
                } else {
                    ScrollView {
                        ScrollViewReader { proxy in
                            Text(logText)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(QadbakPalette.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(16)
                                .id("log-bottom")
                                .onAppear { proxy.scrollTo("log-bottom", anchor: .bottom) }
                                .onChange(of: logText) { _, _ in
                                    proxy.scrollTo("log-bottom", anchor: .bottom)
                                }
                        }
                    }
                    .background(QadbakPalette.card)
                }
            }
        }
        .navigationTitle("Live logs")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Toggle(isOn: $autoRefresh) {
                    Image(systemName: autoRefresh ? "arrow.clockwise.circle.fill" : "arrow.clockwise.circle")
                }
                .labelsHidden()
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .onReceive(timer) { _ in
            guard autoRefresh else { return }
            Task { await load(silent: true) }
        }
        .preferredColorScheme(.dark)
    }

    private func load(silent: Bool = false) async {
        guard let hosting = appState.hostingAPI else { return }
        if !silent { isLoading = true }
        if !silent { errorMessage = nil }
        defer { if !silent { isLoading = false } }
        do {
            let res = try await hosting.websiteLogs(domainName, type: logType)
            logText = res.log ?? ""
        } catch {
            if !silent { errorMessage = error.localizedDescription }
        }
    }
}

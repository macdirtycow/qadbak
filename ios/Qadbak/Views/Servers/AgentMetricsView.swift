import SwiftUI

struct AgentMetricsView: View {
    @Environment(AppState.self) private var appState

    @State private var samples: [AgentMetricSample] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        QBScreenContainer {
            Group {
                if isLoading && samples.isEmpty {
                    QBLoadingState(message: "Loading metrics history…")
                } else if samples.isEmpty, errorMessage == nil {
                    QBEmptyState(
                        title: "No history yet",
                        message: "Metrics are recorded every few minutes after the agent starts.",
                        icon: "chart.xyaxis.line"
                    )
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if let errorMessage { ErrorBanner(message: errorMessage) }
                            if !cpuValues.isEmpty {
                                metricSection(title: "CPU", values: cpuValues, suffix: "%", tint: QadbakPalette.accent)
                            }
                            if !memoryPercents.isEmpty {
                                metricSection(title: "Memory", values: memoryPercents, suffix: "%", tint: .cyan)
                            }
                            sampleList
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Metrics")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .preferredColorScheme(.dark)
    }

    private var sampleList: some View {
        VStack(alignment: .leading, spacing: 8) {
            QBSectionHeader(title: "Recent samples")
            ForEach(samples.reversed()) { sample in
                QBGlassCard {
                    HStack {
                        Text(formatTimestamp(sample.timestamp))
                            .font(.caption.monospaced())
                            .foregroundStyle(QadbakPalette.muted)
                        Spacer()
                        if let cpu = sample.cpuPercent {
                            Text(String(format: "CPU %.0f%%", cpu))
                                .font(.caption)
                                .foregroundStyle(QadbakPalette.text)
                        }
                    }
                }
            }
        }
    }

    private func metricSection(title: String, values: [Double], suffix: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            MetricsSparkline(values: values, tint: tint)
                .frame(height: 56)
            if let latest = values.last {
                Text(String(format: "Latest: %.1f%@", latest, suffix))
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
        }
    }

    private var cpuValues: [Double] {
        samples.compactMap(\.cpuPercent)
    }

    private var memoryPercents: [Double] {
        samples.compactMap { sample in
            guard let used = sample.memoryUsedBytes, let total = sample.memoryTotalBytes, total > 0 else { return nil }
            return Double(used) / Double(total) * 100
        }
    }

    private func reload() async {
        guard let client = (appState.activeProvider as? QadbakAgentProvider)?.apiClient else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            samples = try await client.metrics(limit: 60)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func formatTimestamp(_ raw: String?) -> String {
        guard let raw else { return "—" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw) {
            return date.formatted(date: .abbreviated, time: .shortened)
        }
        return raw
    }
}

private struct MetricsSparkline: View {
    let values: [Double]
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            let maxVal = max(values.max() ?? 1, 1)
            Path { path in
                guard values.count > 1 else { return }
                for (idx, value) in values.enumerated() {
                    let x = geo.size.width * CGFloat(idx) / CGFloat(values.count - 1)
                    let y = geo.size.height * (1 - CGFloat(value / maxVal))
                    if idx == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(tint, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
        }
    }
}

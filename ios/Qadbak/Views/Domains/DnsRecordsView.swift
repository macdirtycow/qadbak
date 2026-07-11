import SwiftUI

struct DnsRecordsView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var records: [DnsRecord] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var recordToDelete: DnsRecord?
    @State private var showAdd = false

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            Group {
                if isLoading && records.isEmpty {
                    QBLoadingState(message: "Loading DNS…")
                } else if records.isEmpty {
                    QBEmptyState(
                        title: "No DNS records",
                        message: "Add your first record for this domain.",
                        icon: "network.slash"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(records) { record in
                                dnsCard(record)
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("DNS")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .safeAreaInset(edge: .top) { banners }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QadbakPalette.accent)
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showAdd) {
            NavigationStack {
                AddDnsRecordView(domainName: domainName) {
                    showAdd = false
                    Task { await load() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete DNS record?", isPresented: Binding(
            get: { recordToDelete != nil },
            set: { if !$0 { recordToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let record = recordToDelete {
                    Task { await delete(record) }
                }
            }
            Button("Cancel", role: .cancel) { recordToDelete = nil }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var banners: some View {
        VStack(spacing: 8) {
            if let errorMessage { ErrorBanner(message: errorMessage) }
            if let successMessage { SuccessBanner(message: successMessage) }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private func dnsCard(_ record: DnsRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(record.type)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(QadbakPalette.glow.opacity(0.25), in: Capsule())
                    .foregroundStyle(QadbakPalette.primary)
                Text(record.name)
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Spacer()
                Button(role: .destructive) {
                    recordToDelete = record
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                }
            }
            Text(record.value)
                .font(.subheadline)
                .foregroundStyle(QadbakPalette.muted)
            if let ttl = record.ttl, !ttl.isEmpty {
                Text("TTL \(ttl)")
                    .font(.caption2)
                    .foregroundStyle(QadbakPalette.muted.opacity(0.7))
            }
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.5), lineWidth: 1)
        }
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            records = try await api.listDns(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ record: DnsRecord) async {
        guard let api = appState.api else { return }
        errorMessage = nil
        successMessage = nil
        defer { recordToDelete = nil }
        do {
            try await api.deleteDns(domainName, record: record)
            successMessage = "DNS record removed."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AddDnsRecordView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let domainName: String
    let onSaved: () -> Void

    @State private var name = "@"
    @State private var type = "A"
    @State private var value = ""
    @State private var ttl = "3600"
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let recordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    QBTextField(label: "Name (@ = root)", placeholder: "@", text: $name)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Type")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(QadbakPalette.muted)
                        Picker("Type", selection: $type) {
                            ForEach(recordTypes, id: \.self) { t in
                                Text(t).tag(t)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    QBTextField(label: "Value", placeholder: "203.0.113.10", text: $value)
                    QBTextField(label: "TTL", placeholder: "3600", text: $ttl, keyboard: .numberPad)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBPrimaryButton(title: "Save record", loading: isSaving, disabled: value.isEmpty) {
                        Task { await save() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Add DNS")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(QadbakPalette.accent)
            }
        }
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        let record = DnsRecord(name: name, type: type, value: value, ttl: ttl, priority: nil)
        do {
            try await api.addDns(domainName, record: record)
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

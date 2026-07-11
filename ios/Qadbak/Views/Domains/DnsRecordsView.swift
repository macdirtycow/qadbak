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
        Group {
            if isLoading && records.isEmpty {
                ProgressView("Loading DNS…")
            } else if records.isEmpty {
                ContentUnavailableView(
                    "No records",
                    systemImage: "network.slash",
                    description: Text("Add your first DNS record.")
                )
            } else {
                List {
                    ForEach(records) { record in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(record.type)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(QadbakTheme.accent.opacity(0.15), in: Capsule())
                                Text(record.name)
                                    .font(.headline)
                            }
                            Text(record.value)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let ttl = record.ttl, !ttl.isEmpty {
                                Text("TTL \(ttl)")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button("Delete", role: .destructive) {
                                recordToDelete = record
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("DNS")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 8) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }
                if let successMessage {
                    SuccessBanner(message: successMessage)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
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
        }
        .confirmationDialog(
            "Delete DNS record?",
            isPresented: Binding(
                get: { recordToDelete != nil },
                set: { if !$0 { recordToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let record = recordToDelete {
                    Task { await delete(record) }
                }
            }
            Button("Cancel", role: .cancel) { recordToDelete = nil }
        } message: {
            if let record = recordToDelete {
                Text("\(record.type) \(record.name) → \(record.value)")
            }
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
        isLoading = true
        errorMessage = nil
        successMessage = nil
        defer {
            isLoading = false
            recordToDelete = nil
        }
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
        Form {
            Section("Record") {
                TextField("Name (@ for root)", text: $name)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Picker("Type", selection: $type) {
                    ForEach(recordTypes, id: \.self) { t in
                        Text(t).tag(t)
                    }
                }
                TextField("Value", text: $value)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("TTL", text: $ttl)
                    .keyboardType(.numberPad)
            }
            if let errorMessage {
                Section {
                    ErrorBanner(message: errorMessage)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            Section {
                Button("Save record") {
                    Task { await save() }
                }
                .disabled(isSaving || value.isEmpty)
            }
        }
        .navigationTitle("Add DNS")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
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

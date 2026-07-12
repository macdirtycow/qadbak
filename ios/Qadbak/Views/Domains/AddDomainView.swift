import SwiftUI

struct AddDomainView: View {
    @Environment(AppState.self) private var appState
    let onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var domainName = ""
    @State private var unixUser = ""
    @State private var unixPassword = ""
    @State private var plan = "Default"
    @State private var domainType = "top"
    @State private var parentDomain = ""
    @State private var createClientAccount = true
    @State private var createPanelVhost = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var result: CreateDomainResponse?

    private let domainTypes = [
        ("top", "Top-level domain"),
        ("sub", "Subdomain"),
        ("alias", "Alias"),
    ]

    var body: some View {
        QBScreenContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    QBScreenHeader(
                        title: "Add domain",
                        subtitle: "Provision hosting on your panel server."
                    )

                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                    }

                    if let result {
                        successCard(result)
                    } else {
                        formFields
                        QBPrimaryButton(title: isSaving ? "Creating…" : "Create domain", loading: isSaving) {
                            Task { await create() }
                        }
                        .disabled(isSaving || domainName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("New domain")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") {
                    if result != nil { onCreated() }
                    dismiss()
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var formFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            QBTextField(label: "Domain name", placeholder: "example.com", text: $domainName)
            Picker("Type", selection: $domainType) {
                ForEach(domainTypes, id: \.0) { value, label in
                    Text(label).tag(value)
                }
            }
            .pickerStyle(.menu)
            .tint(QadbakPalette.accent)

            if domainType != "top" {
                QBTextField(label: "Parent domain", placeholder: "example.com", text: $parentDomain)
            }

            QBTextField(label: "Plan", placeholder: "Default", text: $plan)
            QBTextField(label: "Unix user (optional)", placeholder: "Auto from domain", text: $unixUser)
            QBTextField(label: "Unix password (optional)", placeholder: "Auto-generated", text: $unixPassword, secure: true)

            Toggle(isOn: $createClientAccount) {
                Text("Create panel client account")
                    .foregroundStyle(QadbakPalette.text)
            }
            .tint(QadbakPalette.accent)

            Toggle(isOn: $createPanelVhost) {
                Text("Create panel vhost (Premium)")
                    .foregroundStyle(QadbakPalette.text)
            }
            .tint(QadbakPalette.accent)
        }
    }

    @ViewBuilder
    private func successCard(_ created: CreateDomainResponse) -> some View {
        SuccessBanner(message: "Domain \(created.domain ?? domainName) created.")
        QBGlassCard {
            VStack(alignment: .leading, spacing: 10) {
                if let pass = created.unixPassword, !pass.isEmpty {
                    credentialRow("Unix password", pass)
                }
                if let user = created.clientUsername, !user.isEmpty {
                    credentialRow("Client username", user)
                }
                if let pass = created.clientPassword, !pass.isEmpty {
                    credentialRow("Client password", pass)
                }
                if let url = created.panelUrl, !url.isEmpty {
                    credentialRow("Panel URL", url)
                }
                if let note = created.dnsNote, !note.isEmpty {
                    Text(note).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
                if let note = created.hostingNote, !note.isEmpty {
                    Text(note).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
            }
        }
        QBPrimaryButton(title: "Done") {
            onCreated()
            dismiss()
        }
    }

    private func credentialRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
            Text(value)
                .font(.subheadline.monospaced())
                .foregroundStyle(QadbakPalette.text)
                .textSelection(.enabled)
        }
    }

    private func create() async {
        guard let hosting = appState.hostingAPI else { return }
        let trimmed = domainName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else {
            errorMessage = "Enter a domain name."
            return
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let request = CreateDomainRequest(
                domain: trimmed,
                pass: unixPassword.nilIfEmpty,
                user: unixUser.nilIfEmpty,
                plan: plan.nilIfEmpty ?? "Default",
                parent: domainType == "top" ? nil : parentDomain.nilIfEmpty,
                type: domainType,
                createClientAccount: createClientAccount,
                createPanelVhost: createPanelVhost
            )
            result = try await hosting.createDomain(request)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}

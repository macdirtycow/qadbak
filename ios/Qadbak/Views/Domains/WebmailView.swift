import SwiftUI

struct WebmailView: View {
    @Environment(AppState.self) private var appState
    let domainName: String
    let mailboxUser: String

    @State private var messages: [MailMessageSummary] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCompose = false
    @State private var selectedMessage: MailMessageSummary?

    private var accountEmail: String {
        mailboxUser.contains("@") ? mailboxUser : "\(mailboxUser)@\(domainName)"
    }

    var body: some View {
        Group {
            if !appState.webmailEnabled {
                ContentUnavailableView(
                    "Premium webmail",
                    systemImage: "envelope.badge.shield.half.filled",
                    description: Text("Built-in webmail requires Qadbak Premium (webmail-ui) on your server.")
                )
            } else if isLoading && messages.isEmpty {
                ProgressView("Loading INBOX…")
            } else if let errorMessage, messages.isEmpty {
                ContentUnavailableView(
                    "Webmail unavailable",
                    systemImage: "envelope.badge",
                    description: Text(errorMessage)
                )
            } else if messages.isEmpty {
                ContentUnavailableView(
                    "Inbox empty",
                    systemImage: "tray",
                    description: Text("No messages in INBOX for \(accountEmail).")
                )
            } else {
                List(messages) { message in
                    Button {
                        selectedMessage = message
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(message.subject ?? "(no subject)")
                                .font(.headline)
                                .lineLimit(2)
                            Text(message.from ?? "—")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            if let date = message.date, !date.isEmpty {
                                Text(date)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Webmail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCompose = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .disabled(!appState.webmailEnabled)
            }
        }
        .safeAreaInset(edge: .top) {
            Text(accountEmail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(.bar)
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showCompose) {
            NavigationStack {
                WebmailComposeView(domainName: domainName, mailboxUser: mailboxUser) {
                    showCompose = false
                    Task { await load() }
                }
            }
        }
        .sheet(item: $selectedMessage) { message in
            NavigationStack {
                WebmailMessageView(
                    domainName: domainName,
                    mailboxUser: mailboxUser,
                    messageId: message.id
                )
            }
        }
    }

    private func load() async {
        guard let api = appState.api, appState.webmailEnabled else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            messages = try await api.listMailMessages(domainName, user: mailboxUser)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct WebmailMessageView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let domainName: String
    let mailboxUser: String
    let messageId: String

    @State private var message: MailMessageDetail?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && message == nil {
                ProgressView()
            } else if let message {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(message.subject ?? "(no subject)")
                            .font(.title3.weight(.semibold))
                        LabeledContent("From", value: message.from ?? "—")
                        if let to = message.to, !to.isEmpty {
                            LabeledContent("To", value: to)
                        }
                        if let date = message.date, !date.isEmpty {
                            LabeledContent("Date", value: date)
                        }
                        Divider()
                        Text(message.bodyText ?? "")
                            .font(.body)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding()
                }
            } else if let errorMessage {
                ContentUnavailableView("Message", systemImage: "envelope", description: Text(errorMessage))
            }
        }
        .navigationTitle("Message")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            message = try await api.fetchMailMessage(domainName, user: mailboxUser, messageId: messageId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct WebmailComposeView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let domainName: String
    let mailboxUser: String
    let onSent: () -> Void

    @State private var to = ""
    @State private var subject = ""
    @State private var bodyText = ""
    @State private var isSending = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Send as \(mailboxUser)@\(domainName)") {
                TextField("To", text: $to)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.emailAddress)
                TextField("Subject", text: $subject)
                TextField("Message", text: $bodyText, axis: .vertical)
                    .lineLimit(6 ... 12)
            }
            if let errorMessage {
                Section {
                    ErrorBanner(message: errorMessage)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            Section {
                Button("Send") {
                    Task { await send() }
                }
                .disabled(isSending || to.isEmpty)
            }
        }
        .navigationTitle("Compose")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private func send() async {
        guard let api = appState.api else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            try await api.sendMail(
                domainName,
                user: mailboxUser,
                to: to,
                subject: subject,
                body: bodyText
            )
            onSent()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

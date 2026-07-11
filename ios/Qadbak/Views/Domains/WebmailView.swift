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
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                Text(accountEmail)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(QadbakPalette.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(QadbakPalette.card.opacity(0.6))
                Group {
                    if !appState.webmailEnabled {
                        QBEmptyState(
                            title: "Premium webmail",
                            message: "Requires Qadbak Premium (webmail-ui) on your server.",
                            icon: "envelope.badge.shield.half.filled"
                        )
                    } else if isLoading && messages.isEmpty {
                        QBLoadingState(message: "Loading INBOX…")
                    } else if let errorMessage, messages.isEmpty {
                        VStack(spacing: 12) {
                            ErrorBanner(message: errorMessage)
                            QBEmptyState(title: "Unavailable", message: "Could not load messages.", icon: "envelope.badge")
                        }
                        .padding(20)
                    } else if messages.isEmpty {
                        QBEmptyState(title: "Inbox empty", message: "No messages for \(accountEmail).", icon: "tray")
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(messages) { message in
                                    Button { selectedMessage = message } label: { messageRow(message) }
                                        .buttonStyle(.plain)
                                }
                            }
                            .padding(20)
                        }
                    }
                }
            }
        }
        .navigationTitle("Webmail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showCompose = true } label: {
                    Image(systemName: "square.and.pencil")
                        .foregroundStyle(QadbakPalette.accent)
                }
                .disabled(!appState.webmailEnabled)
            }
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
            .preferredColorScheme(.dark)
        }
        .sheet(item: $selectedMessage) { message in
            NavigationStack {
                WebmailMessageView(domainName: domainName, mailboxUser: mailboxUser, messageId: message.id)
            }
            .preferredColorScheme(.dark)
        }
        .preferredColorScheme(.dark)
    }

    private func messageRow(_ message: MailMessageSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(message.subject ?? "(no subject)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(QadbakPalette.text)
                .lineLimit(2)
            Text(message.from ?? "—")
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
            if let date = message.date, !date.isEmpty {
                Text(date).font(.caption2).foregroundStyle(QadbakPalette.muted.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func load() async {
        guard let api = appState.api, appState.webmailEnabled else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { messages = try await api.listMailMessages(domainName, user: mailboxUser) }
        catch { errorMessage = error.localizedDescription }
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
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            if isLoading && message == nil {
                ProgressView().tint(QadbakPalette.accent)
            } else if let message {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(message.subject ?? "(no subject)")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(QadbakPalette.text)
                        metaRow("From", message.from ?? "—")
                        if let to = message.to, !to.isEmpty { metaRow("To", to) }
                        if let date = message.date, !date.isEmpty { metaRow("Date", date) }
                        Divider().overlay(QadbakPalette.border)
                        Text(message.bodyText ?? "")
                            .font(.body)
                            .foregroundStyle(QadbakPalette.text.opacity(0.9))
                            .textSelection(.enabled)
                    }
                    .padding(20)
                }
            } else if let errorMessage {
                QBEmptyState(title: "Message", message: errorMessage, icon: "envelope")
            }
        }
        .navigationTitle("Message")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }.foregroundStyle(QadbakPalette.accent)
            }
        }
        .task { await load() }
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).foregroundStyle(QadbakPalette.muted).frame(width: 48, alignment: .leading)
            Text(value).foregroundStyle(QadbakPalette.text)
        }
        .font(.subheadline)
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { message = try await api.fetchMailMessage(domainName, user: mailboxUser, messageId: messageId) }
        catch { errorMessage = error.localizedDescription }
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
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text("Send as \(mailboxUser)@\(domainName)")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    QBTextField(label: "To", placeholder: "name@example.com", text: $to, keyboard: .emailAddress)
                    QBTextField(label: "Subject", placeholder: "Subject", text: $subject)
                    QBTextField(label: "Message", placeholder: "Write your message…", text: $bodyText)
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBPrimaryButton(title: "Send", loading: isSending, disabled: to.isEmpty) {
                        Task { await send() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Compose")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }.foregroundStyle(QadbakPalette.accent)
            }
        }
    }

    private func send() async {
        guard let api = appState.api else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            try await api.sendMail(domainName, user: mailboxUser, to: to, subject: subject, body: bodyText)
            onSent()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}

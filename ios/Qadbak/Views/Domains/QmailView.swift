import SwiftUI

struct QmailView: View {
    @Environment(AppState.self) private var appState
    @State private var model: QmailViewModel
    @State private var composeDraft: ComposeDraft?
    @State private var showFolderGrid = false

    init(domainName: String, mailboxUser: String) {
        _model = State(initialValue: QmailViewModel(domainName: domainName, mailboxUser: mailboxUser))
    }

    var body: some View {
        ZStack {
            QadbakBackground()
            content
        }
        .navigationTitle("Qmail")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(QadbakPalette.bg.opacity(0.95), for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                QadbakLogoMark(size: 28)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    composeDraft = ComposeDraft(mode: .new)
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .disabled(model.premiumBlocked || model.imapUnavailable)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showFolderGrid = true
                } label: {
                    Image(systemName: "folder.fill")
                }
                .disabled(model.folders.isEmpty)
            }
        }
        .searchable(text: $model.searchQuery, prompt: "Search in Qmail")
        .navigationDestination(for: MailNavTarget.self) { target in
            QmailMessageDetailView(
                domainName: model.domainName,
                mailboxUser: model.mailboxUser,
                messageId: target.messageId,
                folder: target.folder,
                selfEmail: model.accountEmail.lowercased()
            ) { draft in
                composeDraft = draft
            }
        }
        .sheet(item: $composeDraft) { draft in
            NavigationStack {
                QmailComposeView(
                    domainName: model.domainName,
                    mailboxUser: model.mailboxUser,
                    draft: draft
                ) {
                    composeDraft = nil
                    Task { await refresh() }
                }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showFolderGrid) {
            NavigationStack {
                QmailFolderGridView(model: model) { folder in
                    showFolderGrid = false
                    Task {
                        guard let api = appState.api else { return }
                        await model.selectFolder(folder, api: api)
                    }
                }
            }
            .preferredColorScheme(.dark)
        }
        .refreshable { await refresh() }
        .task {
            await appState.refreshSessionInfo()
            await refresh()
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        if model.premiumBlocked {
            blockedState(
                title: "Premium required",
                message: model.errorMessage ?? "Enable Qadbak Premium (webmail-ui) on your panel.",
                icon: "envelope.badge.shield.half.filled"
            )
        } else if model.imapUnavailable {
            blockedState(
                title: "IMAP not available",
                message: model.errorMessage ?? "Ask your admin to enable IMAP on the panel server.",
                icon: "server.rack"
            )
        } else if model.isLoading && model.messages.isEmpty {
            QBLoadingState(message: "Loading \(model.folderLabel)…")
        } else if let errorMessage = model.errorMessage, model.messages.isEmpty {
            VStack(spacing: 12) {
                ErrorBanner(message: errorMessage)
                QBEmptyState(title: "Could not load mail", message: "Check the mailbox and try again.", icon: "envelope.badge")
                QBPrimaryButton(title: "Retry") { Task { await refresh() } }
            }
            .padding(20)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    headerCard
                    messageSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model.folderLabel)
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(QadbakPalette.text)
                    Text(model.accountEmail)
                        .font(.subheadline)
                        .foregroundStyle(QadbakPalette.muted)
                }
                Spacer()
                Image(systemName: QmailFolderIcon.systemImage(for: model.selectedFolder))
                    .font(.title2)
                    .foregroundStyle(QadbakPalette.glow)
                    .frame(width: 44, height: 44)
                    .background(QadbakPalette.bg.opacity(0.6), in: Circle())
            }

            if !model.folders.isEmpty {
                Menu {
                    ForEach(model.folders) { folder in
                        Button {
                            Task {
                                guard let api = appState.api else { return }
                                await model.selectFolder(folder.folderQueryValue, api: api)
                            }
                        } label: {
                            if let count = folder.messages, count > 0 {
                                Text("\(folder.displayName) (\(count))")
                            } else {
                                Text(folder.displayName)
                            }
                        }
                    }
                } label: {
                    QmailFolderPill(
                        title: model.folderLabel,
                        systemImage: QmailFolderIcon.systemImage(for: model.selectedFolder)
                    )
                }
            }

            HStack(spacing: 10) {
                QmailStatPill(title: "Total", value: "\(model.totalCount)")
                QmailStatPill(title: "Unread", value: "\(model.unreadCount)")
                QmailStatPill(title: "Shown", value: "\(model.filteredMessages.count)")
            }

            Label(model.statusLine, systemImage: "arrow.triangle.2.circlepath")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(QadbakPalette.muted)
        }
        .padding(18)
        .background(QadbakPalette.card.opacity(0.95), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.65), lineWidth: 1)
        }
    }

    @ViewBuilder
    private var messageSection: some View {
        if model.messages.isEmpty {
            QBEmptyState(
                title: "\(model.folderLabel) is empty",
                message: "No messages for \(model.accountEmail).",
                icon: "tray"
            )
            .padding(.top, 12)
        } else if model.filteredMessages.isEmpty {
            QBEmptyState(title: "No matches", message: "Try another search.", icon: "magnifyingglass")
                .padding(.top, 12)
        } else {
            LazyVStack(spacing: 10) {
                ForEach(model.filteredMessages) { message in
                    NavigationLink(value: MailNavTarget(messageId: message.id, folder: model.selectedFolder)) {
                        QmailMessageRow(message: message)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func blockedState(title: String, message: String, icon: String) -> some View {
        VStack(spacing: 16) {
            QBEmptyState(title: title, message: message, icon: icon)
            QBPrimaryButton(title: "Retry") { Task { await refresh() } }
        }
        .padding(20)
    }

    private func refresh() async {
        guard let api = appState.api else { return }
        await model.reload(using: api)
    }
}

struct QmailFolderGridView: View {
    @Environment(\.dismiss) private var dismiss
    let model: QmailViewModel
    let onSelect: (String) -> Void

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(model.folders) { folder in
                        Button {
                            onSelect(folder.folderQueryValue)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: QmailFolderIcon.systemImage(for: folder.folderQueryValue))
                                    .font(.title3)
                                    .foregroundStyle(QadbakPalette.glow)
                                Text(folder.displayName)
                                    .font(.headline)
                                    .foregroundStyle(QadbakPalette.text)
                                if let count = folder.messages {
                                    Text("\(count) messages")
                                        .font(.caption)
                                        .foregroundStyle(QadbakPalette.muted)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("Mailboxes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
    }
}

struct QmailMessageDetailView: View {
    @Environment(AppState.self) private var appState

    let domainName: String
    let mailboxUser: String
    let messageId: String
    let folder: String
    let selfEmail: String
    let onCompose: (ComposeDraft) -> Void

    @State private var message: MailMessageDetail?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRawHeaders = false

    var body: some View {
        ZStack {
            QadbakBackground()
            if isLoading && message == nil {
                QBLoadingState(message: "Opening message…")
            } else if let message {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        senderCard(message)
                        actionRow(message)
                        Text(message.subject ?? "(No subject)")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(QadbakPalette.text)
                        metaRow("From", message.from ?? "—")
                        if let to = message.to, !to.isEmpty { metaRow("To", to) }
                        if let cc = message.cc, !cc.isEmpty { metaRow("Cc", cc) }
                        if let date = message.date, !date.isEmpty { metaRow("Date", date) }
                        Divider().overlay(QadbakPalette.border)
                        Text(bodyText(for: message))
                            .font(.body)
                            .foregroundStyle(QadbakPalette.text.opacity(0.92))
                            .textSelection(.enabled)
                        if let headers = message.rawHeaders, !headers.isEmpty {
                            DisclosureGroup(isExpanded: $showRawHeaders) {
                                Text(headers)
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundStyle(QadbakPalette.muted)
                                    .textSelection(.enabled)
                            } label: {
                                Text("Raw headers")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(QadbakPalette.accent)
                            }
                        }
                    }
                    .padding(20)
                }
            } else if let errorMessage {
                VStack(spacing: 12) {
                    ErrorBanner(message: errorMessage)
                    QBPrimaryButton(title: "Retry") { Task { await load() } }
                }
                .padding(20)
            }
        }
        .navigationTitle("Message")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func senderCard(_ message: MailMessageDetail) -> some View {
        HStack(spacing: 12) {
            QmailAvatar(label: message.from ?? "", size: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(MailReplyHelpers.displayName(from: message.from))
                    .font(.headline)
                    .foregroundStyle(QadbakPalette.text)
                Text(MailReplyHelpers.parseEmailAddress(message.from))
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
            }
            Spacer()
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func actionRow(_ message: MailMessageDetail) -> some View {
        HStack(spacing: 8) {
            actionButton("Reply", icon: "arrowshape.turn.up.left") {
                onCompose(MailReplyHelpers.draft(mode: .reply, message: message, selfEmail: selfEmail))
            }
            actionButton("Reply all", icon: "arrowshape.turn.up.left.2") {
                onCompose(MailReplyHelpers.draft(mode: .replyAll, message: message, selfEmail: selfEmail))
            }
            actionButton("Forward", icon: "arrowshape.turn.up.right") {
                onCompose(MailReplyHelpers.draft(mode: .forward, message: message, selfEmail: selfEmail))
            }
        }
    }

    private func actionButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .foregroundStyle(QadbakPalette.text)
                .background(QadbakPalette.card, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).foregroundStyle(QadbakPalette.muted).frame(width: 48, alignment: .leading)
            Text(value).foregroundStyle(QadbakPalette.text)
        }
        .font(.subheadline)
    }

    private func bodyText(for message: MailMessageDetail) -> String {
        let text = message.bodyText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return text.isEmpty ? "(No plain-text body)" : text
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            message = try await api.fetchMailMessage(
                domainName,
                user: mailboxUser,
                messageId: messageId,
                folder: folder
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct QmailComposeView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let domainName: String
    let mailboxUser: String
    let draft: ComposeDraft
    let onSent: () -> Void

    @State private var to: String
    @State private var cc: String
    @State private var subject: String
    @State private var bodyText: String
    @State private var isSending = false
    @State private var errorMessage: String?

    init(
        domainName: String,
        mailboxUser: String,
        draft: ComposeDraft,
        onSent: @escaping () -> Void
    ) {
        self.domainName = domainName
        self.mailboxUser = mailboxUser
        self.draft = draft
        self.onSent = onSent
        _to = State(initialValue: draft.to)
        _cc = State(initialValue: draft.cc)
        _subject = State(initialValue: draft.subject)
        _bodyText = State(initialValue: draft.body)
    }

    private var title: String {
        switch draft.mode {
        case .new: return "New message"
        case .reply: return "Reply"
        case .replyAll: return "Reply all"
        case .forward: return "Forward"
        }
    }

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text("Sending as \(mailboxUser)@\(domainName)")
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    QBTextField(label: "To", placeholder: "name@example.com", text: $to, keyboard: .emailAddress)
                    QBTextField(label: "Cc (optional)", placeholder: "cc@example.com", text: $cc, keyboard: .emailAddress)
                    QBTextField(label: "Subject", placeholder: "Subject", text: $subject)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Message")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(QadbakPalette.muted)
                        TextEditor(text: $bodyText)
                            .frame(minHeight: 220)
                            .scrollContentBackground(.hidden)
                            .padding(10)
                            .foregroundStyle(QadbakPalette.text)
                            .background(QadbakPalette.bg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(QadbakPalette.border, lineWidth: 1)
                            }
                    }
                    if let errorMessage { ErrorBanner(message: errorMessage) }
                    QBPrimaryButton(
                        title: "Send",
                        loading: isSending,
                        disabled: to.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ) {
                        Task { await send() }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle(title)
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
            try await api.sendMail(
                domainName,
                user: mailboxUser,
                to: to.trimmingCharacters(in: .whitespacesAndNewlines),
                subject: subject,
                body: bodyText,
                cc: cc.trimmingCharacters(in: .whitespacesAndNewlines),
                inReplyTo: draft.inReplyTo,
                references: draft.references
            )
            onSent()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

import Foundation

enum ComposeMode: String {
    case new
    case reply
    case replyAll
    case forward
}

enum MailReplyHelpers {
    static func displayName(from header: String?) -> String {
        let raw = header?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty else { return "Unknown sender" }
        if let start = raw.firstIndex(of: "<") {
            let name = String(raw[..<start]).trimmingCharacters(in: CharacterSet(charactersIn: "\" ")).trimmingCharacters(in: .whitespaces)
            if !name.isEmpty { return name }
        }
        let email = parseEmailAddress(raw)
        if email.contains("@") {
            return email.components(separatedBy: "@").first ?? email
        }
        return raw
    }

    static func parseEmailAddress(_ header: String?) -> String {
        let raw = header?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty else { return "" }
        if let start = raw.firstIndex(of: "<"), let end = raw.firstIndex(of: ">"), start < end {
            return String(raw[raw.index(after: start)..<end]).trimmingCharacters(in: .whitespaces).lowercased()
        }
        if let match = raw.range(of: #"[\w.+-]+@[\w.-]+\.\w+"#, options: .regularExpression) {
            return String(raw[match]).lowercased()
        }
        return raw.lowercased()
    }

    static func parseAddressList(_ header: String?) -> [String] {
        let raw = header?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty else { return [] }
        var out = Set<String>()
        for part in raw.split(separator: ",") {
            let addr = parseEmailAddress(String(part))
            if addr.contains("@") { out.insert(addr) }
        }
        return Array(out)
    }

    static func replySubject(_ subject: String) -> String {
        let s = subject.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = s.isEmpty ? "(no subject)" : s
        if base.range(of: #"^re:\s"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return base
        }
        return "Re: \(base)"
    }

    static func forwardSubject(_ subject: String) -> String {
        let s = subject.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = s.isEmpty ? "(no subject)" : s
        if base.range(of: #"^(fwd|fw):\s"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return base
        }
        return "Fwd: \(base)"
    }

    static func quoteReplyBody(from: String?, date: String?, bodyText: String?) -> String {
        let sender = (from?.isEmpty == false) ? from! : "unknown sender"
        let when = (date?.isEmpty == false) ? "On \(date!), " : ""
        let body = bodyText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if body.isEmpty { return "\n\n\(when)\(sender) wrote:\n" }
        let quoted = body.split(separator: "\n", omittingEmptySubsequences: false)
            .map { "> \($0)" }
            .joined(separator: "\n")
        return "\n\n\(when)\(sender) wrote:\n\(quoted)\n"
    }

    static func forwardBody(
        from: String?,
        to: String?,
        date: String?,
        subject: String?,
        bodyText: String?
    ) -> String {
        var lines = ["---------- Forwarded message ----------"]
        if let from, !from.isEmpty { lines.append("From: \(from)") }
        if let date, !date.isEmpty { lines.append("Date: \(date)") }
        if let to, !to.isEmpty { lines.append("To: \(to)") }
        if let subject, !subject.isEmpty { lines.append("Subject: \(subject)") }
        lines.append("")
        lines.append(bodyText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
        return "\n\n\(lines.joined(separator: "\n"))\n"
    }

    static func buildReferencesHeader(existing: String?, messageId: String?) -> String {
        let id = messageId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !id.isEmpty else { return existing?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }
        let prior = existing?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if prior.isEmpty { return id }
        if prior.contains(id) { return prior }
        return "\(prior) \(id)"
    }

    static func draft(
        mode: ComposeMode,
        message: MailMessageDetail,
        selfEmail: String
    ) -> ComposeDraft {
        let replyAddr = parseEmailAddress(message.replyTo ?? message.from)
        switch mode {
        case .forward:
            return ComposeDraft(
                mode: .forward,
                to: "",
                cc: "",
                subject: forwardSubject(message.subject ?? ""),
                body: forwardBody(
                    from: message.from,
                    to: message.to,
                    date: message.date,
                    subject: message.subject,
                    bodyText: message.bodyText
                ),
                inReplyTo: "",
                references: ""
            )
        case .replyAll:
            var others = Set(parseAddressList(message.to) + parseAddressList(message.cc) + parseAddressList(message.from))
            others.remove(selfEmail.lowercased())
            if !replyAddr.isEmpty { others.remove(replyAddr) }
            return ComposeDraft(
                mode: .replyAll,
                to: replyAddr,
                cc: others.sorted().joined(separator: ", "),
                subject: replySubject(message.subject ?? ""),
                body: quoteReplyBody(from: message.from, date: message.date, bodyText: message.bodyText),
                inReplyTo: message.messageId ?? "",
                references: buildReferencesHeader(existing: message.references, messageId: message.messageId)
            )
        case .reply:
            return ComposeDraft(
                mode: .reply,
                to: replyAddr,
                cc: "",
                subject: replySubject(message.subject ?? ""),
                body: quoteReplyBody(from: message.from, date: message.date, bodyText: message.bodyText),
                inReplyTo: message.messageId ?? "",
                references: buildReferencesHeader(existing: message.references, messageId: message.messageId)
            )
        case .new:
            return ComposeDraft(mode: .new)
        }
    }
}

struct ComposeDraft: Identifiable {
    let id = UUID()
    var mode: ComposeMode
    var to: String
    var cc: String
    var subject: String
    var body: String
    var inReplyTo: String
    var references: String

    init(
        mode: ComposeMode = .new,
        to: String = "",
        cc: String = "",
        subject: String = "",
        body: String = "",
        inReplyTo: String = "",
        references: String = ""
    ) {
        self.mode = mode
        self.to = to
        self.cc = cc
        self.subject = subject
        self.body = body
        self.inReplyTo = inReplyTo
        self.references = references
    }
}

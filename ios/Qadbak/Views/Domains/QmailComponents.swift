import SwiftUI

enum QmailFolderIcon {
    static func systemImage(for folder: String) -> String {
        let key = folder.uppercased()
        if key == "INBOX" { return "tray.fill" }
        if key.contains("SENT") { return "paperplane.fill" }
        if key.contains("DRAFT") { return "doc.text.fill" }
        if key.contains("TRASH") || key.contains("DELETED") { return "trash.fill" }
        if key.contains("SPAM") || key.contains("JUNK") { return "exclamationmark.octagon.fill" }
        if key.contains("ARCHIVE") { return "archivebox.fill" }
        return "folder.fill"
    }
}

struct QmailAvatar: View {
    let label: String
    var size: CGFloat = 42

    private var initials: String {
        let cleaned = MailReplyHelpers.parseEmailAddress(label)
        let name = cleaned.components(separatedBy: "@").first ?? cleaned
        let parts = name.split(whereSeparator: { !$0.isLetter }).map(String.init)
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [QadbakPalette.glow.opacity(0.85), Color.cyan.opacity(0.55)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(initials)
                .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

struct QmailStatPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(QadbakPalette.muted)
            Text(value)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(QadbakPalette.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(QadbakPalette.bg.opacity(0.55), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct QmailFolderPill: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(QadbakPalette.text)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(QadbakPalette.card, in: Capsule())
            .overlay(Capsule().strokeBorder(QadbakPalette.border.opacity(0.7), lineWidth: 1))
    }
}

struct QmailMessageRow: View {
    let message: MailMessageSummary

    private var sender: String {
        MailReplyHelpers.displayName(from: message.from)
    }

    private var dateText: String {
        QmailFormatters.compactDate(message.date)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            QmailAvatar(label: message.from ?? sender)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(sender)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(QadbakPalette.text)
                            .lineLimit(1)
                        Text(message.subject?.isEmpty == false ? (message.subject ?? "") : "(No subject)")
                            .font(.subheadline)
                            .foregroundStyle(QadbakPalette.text.opacity(0.92))
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Text(dateText)
                        .font(.caption)
                        .foregroundStyle(QadbakPalette.muted)
                }
                if let preview = message.preview, !preview.isEmpty {
                    Text(preview)
                        .font(.footnote)
                        .foregroundStyle(QadbakPalette.muted)
                        .lineLimit(2)
                }
            }
        }
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.55), lineWidth: 1)
        }
    }
}

enum QmailFormatters {
    static func compactDate(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 12, !trimmed.contains(":") { return trimmed }
        let formats = [
            "EEE, d MMM yyyy HH:mm:ss Z",
            "EEE, d MMM yyyy HH:mm:ss zzz",
            "d MMM yyyy HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
        ]
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        for format in formats {
            parser.dateFormat = format
            if let date = parser.date(from: trimmed) {
                let out = RelativeDateTimeFormatter()
                out.unitsStyle = .abbreviated
                return out.localizedString(for: date, relativeTo: Date())
            }
        }
        return String(trimmed.prefix(16))
    }
}

struct MailNavTarget: Hashable, Identifiable {
    let messageId: String
    let folder: String

    var id: String { "\(folder)/\(messageId)" }
}

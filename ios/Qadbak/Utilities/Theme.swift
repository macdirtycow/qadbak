import SwiftUI

// Matches Qadbak web panel (globals.css)
enum QadbakPalette {
    static let bg = Color(red: 15/255, green: 20/255, blue: 25/255)
    static let card = Color(red: 26/255, green: 35/255, blue: 50/255)
    static let border = Color(red: 45/255, green: 58/255, blue: 79/255)
    static let text = Color(red: 241/255, green: 245/255, blue: 249/255)
    static let muted = Color(red: 148/255, green: 163/255, blue: 184/255)
    static let primary = Color(red: 232/255, green: 236/255, blue: 244/255)
    static let accent = Color(red: 203/255, green: 213/255, blue: 225/255)
    static let glow = Color(red: 99/255, green: 102/255, blue: 241/255)
    static let success = Color(red: 52/255, green: 211/255, blue: 153/255)
    static let warning = Color(red: 251/255, green: 191/255, blue: 36/255)
    static let danger = Color(red: 248/255, green: 113/255, blue: 113/255)
}

enum QadbakTheme {
    static let accent = QadbakPalette.accent
    static let card = QadbakPalette.card
}

struct QadbakBackground: View {
    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            RadialGradient(
                colors: [
                    QadbakPalette.glow.opacity(0.18),
                    QadbakPalette.bg.opacity(0),
                ],
                center: .topTrailing,
                startRadius: 40,
                endRadius: 420
            )
            .ignoresSafeArea()
            RadialGradient(
                colors: [
                    QadbakPalette.accent.opacity(0.08),
                    QadbakPalette.bg.opacity(0),
                ],
                center: .bottomLeading,
                startRadius: 20,
                endRadius: 360
            )
            .ignoresSafeArea()
        }
    }
}

struct QadbakLogoMark: View {
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
                .fill(QadbakPalette.card)
            RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
                .strokeBorder(QadbakPalette.accent.opacity(0.28), lineWidth: 1)
            Image(systemName: "q.circle.fill")
                .font(.system(size: size * 0.52, weight: .medium))
                .foregroundStyle(QadbakPalette.primary)
        }
        .frame(width: size, height: size)
        .shadow(color: QadbakPalette.glow.opacity(0.35), radius: 12, y: 4)
    }
}

struct QBGlassCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(16)
            .background {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(QadbakPalette.card.opacity(0.92))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(QadbakPalette.border.opacity(0.65), lineWidth: 1)
                    }
            }
    }
}

struct QBPrimaryButton: View {
    let title: String
    var loading = false
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if loading {
                    ProgressView()
                        .tint(QadbakPalette.bg)
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(QadbakPalette.bg)
            .background(
                LinearGradient(
                    colors: [QadbakPalette.primary, QadbakPalette.accent],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
        }
        .disabled(disabled || loading)
        .opacity(disabled ? 0.55 : 1)
    }
}

struct QBTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(QadbakPalette.muted)
            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboard)
                }
            }
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(14)
            .foregroundStyle(QadbakPalette.text)
            .background(QadbakPalette.bg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(QadbakPalette.border, lineWidth: 1)
            }
        }
    }
}

struct QBStatTile: View {
    let title: String
    let value: String
    let icon: String
    var tone: Color = QadbakPalette.accent

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.caption.weight(.bold))
                .foregroundStyle(tone)
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundStyle(QadbakPalette.text)
            Text(title)
                .font(.caption)
                .foregroundStyle(QadbakPalette.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QadbakPalette.card.opacity(0.85), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.5), lineWidth: 1)
        }
    }
}

struct QBActionTile: View {
    let title: String
    let subtitle: String
    let icon: String
    var tint: Color = QadbakPalette.glow

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 0) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(tint.opacity(0.18))
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(tint)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(QadbakPalette.muted.opacity(0.55))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(QadbakPalette.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .allowsTightening(true)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(QadbakPalette.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .allowsTightening(true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
        .padding(12)
        .background(QadbakPalette.card.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(QadbakPalette.border.opacity(0.45), lineWidth: 1)
        }
    }
}

struct QBScreenHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(QadbakPalette.text)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.muted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct QBEmptyState: View {
    let title: String
    let message: String
    let icon: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(QadbakPalette.muted)
            Text(title)
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(QadbakPalette.muted)
        }
        .padding(32)
    }
}

struct QBLoadingState: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(QadbakPalette.accent)
                .scaleEffect(1.1)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(QadbakPalette.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.subheadline)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QadbakPalette.danger.opacity(0.9), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct SuccessBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
            Text(message)
                .font(.subheadline)
        }
        .foregroundStyle(QadbakPalette.bg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QadbakPalette.success.opacity(0.92), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct QBScreenContainer<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            QadbakBackground()
            content
        }
    }
}

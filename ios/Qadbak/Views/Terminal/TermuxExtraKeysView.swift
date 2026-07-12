import SwiftUI

/// Termux-inspired extra keys bar (two rows of special terminal keys).
struct TermuxExtraKeysView: View {
    @Binding var ctrlActive: Bool
    @Binding var altActive: Bool
    let onKey: (String) -> Void

    private let row1: [TermuxKey] = [
        .special("ESC"), .char("|"), .char("/"), .special("HOME"),
        .special("UP"), .special("END"), .special("PGUP"),
    ]

    private let row2: [TermuxKey] = [
        .special("TAB"), .special("CTRL"), .special("ALT"), .special("LEFT"),
        .special("DOWN"), .special("RIGHT"), .special("PGDN"), .special("BKSP"),
    ]

    var body: some View {
        VStack(spacing: 4) {
            keyRow(row1)
            keyRow(row2)
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 6)
        .background(QadbakPalette.bg.opacity(0.98))
    }

    private func keyRow(_ keys: [TermuxKey]) -> some View {
        HStack(spacing: 4) {
            ForEach(keys.indices, id: \.self) { index in
                keyButton(keys[index])
            }
        }
    }

    private func keyButton(_ key: TermuxKey) -> some View {
        let label = key.label
        let active = (label == "CTRL" && ctrlActive) || (label == "ALT" && altActive)
        return Button {
            onKey(label)
        } label: {
            Text(key.display)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .foregroundStyle(active ? QadbakPalette.bg : QadbakPalette.text)
                .background(
                    active ? QadbakPalette.accent : QadbakPalette.card,
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
        }
        .buttonStyle(.plain)
    }
}

private enum TermuxKey {
    case special(String)
    case char(String)

    var label: String {
        switch self {
        case .special(let value): return value
        case .char(let value): return value
        }
    }

    var display: String {
        switch label {
        case "UP": return "↑"
        case "DOWN": return "↓"
        case "LEFT": return "←"
        case "RIGHT": return "→"
        case "BKSP": return "⌫"
        case "PGUP": return "PgUp"
        case "PGDN": return "PgDn"
        default: return label
        }
    }
}

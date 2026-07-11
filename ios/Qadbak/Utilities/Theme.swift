import SwiftUI

struct QadbakTheme {
    static let accent = Color(red: 0.22, green: 0.55, blue: 0.95)
    static let card = Color(.secondarySystemGroupedBackground)
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(.red.opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct SuccessBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(.green.opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
    }
}

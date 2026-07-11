import SwiftUI

struct SslCertificatesView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var certs: [SslCert] = []
    @State private var isLoading = false
    @State private var isRenewing = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            VStack(spacing: 16) {
                if let errorMessage { ErrorBanner(message: errorMessage).padding(.horizontal, 20) }
                if let successMessage { SuccessBanner(message: successMessage).padding(.horizontal, 20) }
                if isLoading && certs.isEmpty {
                    QBLoadingState(message: "Loading certificates…")
                } else if certs.isEmpty {
                    QBEmptyState(
                        title: "No certificates",
                        message: "Issue a Let's Encrypt certificate for HTTPS.",
                        icon: "lock.slash"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(certs) { cert in
                                certCard(cert)
                            }
                        }
                        .padding(20)
                    }
                }
                QBPrimaryButton(title: "Renew certificate", loading: isRenewing) {
                    Task { await renew() }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
            }
        }
        .navigationTitle("SSL")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .preferredColorScheme(.dark)
    }

    private func certCard(_ cert: SslCert) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(cert.host ?? domainName)
                .font(.headline)
                .foregroundStyle(QadbakPalette.text)
            if let issuer = cert.issuer {
                Text(issuer)
                    .font(.subheadline)
                    .foregroundStyle(QadbakPalette.muted)
            }
            HStack {
                if let expiry = cert.expiry {
                    Label(expiry, systemImage: "calendar")
                }
                if let type = cert.type {
                    Text(type)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(QadbakPalette.border.opacity(0.4), in: Capsule())
                }
            }
            .font(.caption)
            .foregroundStyle(QadbakPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { certs = try await api.listSsl(domainName) }
        catch { errorMessage = error.localizedDescription }
    }

    private func renew() async {
        guard let api = appState.api else { return }
        isRenewing = true
        errorMessage = nil
        successMessage = nil
        defer { isRenewing = false }
        do {
            try await api.renewSsl(domainName)
            successMessage = "Certificate request started — may take a few minutes."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

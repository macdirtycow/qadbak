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
        Group {
            if isLoading && certs.isEmpty {
                ProgressView("Loading certificates…")
            } else if certs.isEmpty {
                ContentUnavailableView(
                    "No certificates",
                    systemImage: "lock.slash",
                    description: Text("Issue a Let's Encrypt certificate for this domain.")
                )
            } else {
                List(certs) { cert in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(cert.host ?? domainName)
                            .font(.headline)
                        if let issuer = cert.issuer, !issuer.isEmpty {
                            Text(issuer)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            if let expiry = cert.expiry, !expiry.isEmpty {
                                Text("Expires \(expiry)")
                            }
                            if let type = cert.type, !type.isEmpty {
                                Text(type)
                                    .font(.caption)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.secondary.opacity(0.15), in: Capsule())
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("SSL")
        .safeAreaInset(edge: .top) {
            VStack(spacing: 8) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }
                if let successMessage {
                    SuccessBanner(message: successMessage)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await renew() }
                } label: {
                    if isRenewing {
                        ProgressView()
                    } else {
                        Text("Renew")
                    }
                }
                .disabled(isRenewing)
            }
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            certs = try await api.listSsl(domainName)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func renew() async {
        guard let api = appState.api else { return }
        isRenewing = true
        errorMessage = nil
        successMessage = nil
        defer { isRenewing = false }
        do {
            try await api.renewSsl(domainName)
            successMessage = "Certificate request started. This may take a few minutes."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

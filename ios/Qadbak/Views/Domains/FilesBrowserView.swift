import SwiftUI

struct FilesBrowserView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var listing: DomainFilesListing?
    @State private var currentDir = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var fileToView: DomainFileEntry?
    @State private var fileContent: DomainFileContent?
    @State private var fileToDelete: DomainFileEntry?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            Group {
                if isLoading && listing == nil {
                    QBLoadingState(message: "Loading files…")
                } else if let errorMessage, listing == nil {
                    VStack(spacing: 12) {
                        ErrorBanner(message: errorMessage)
                        QBEmptyState(title: "Files unavailable", message: "Native file access may be disabled on this server.", icon: "folder.badge.questionmark")
                    }
                    .padding(20)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            if !breadcrumbs.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 6) {
                                        ForEach(breadcrumbs, id: \.path) { crumb in
                                            Button(crumb.label.isEmpty ? "Home" : crumb.label) {
                                                Task { await openDir(crumb.path) }
                                            }
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(QadbakPalette.accent)
                                            if crumb.path != breadcrumbs.last?.path {
                                                Image(systemName: "chevron.right")
                                                    .font(.caption2)
                                                    .foregroundStyle(QadbakPalette.muted)
                                            }
                                        }
                                    }
                                }
                            }
                            ForEach(entries) { entry in
                                if entry.isDirectory {
                                    Button { Task { await openDir(entry.path) } } label: { fileRow(entry) }
                                        .buttonStyle(.plain)
                                } else {
                                    Button { Task { await openFile(entry) } } label: { fileRow(entry) }
                                        .buttonStyle(.plain)
                                        .contextMenu {
                                            if entry.deletable != false {
                                                Button("Delete", role: .destructive) { fileToDelete = entry }
                                            }
                                        }
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
        }
        .navigationTitle("Files")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .refreshable { await load(dir: currentDir) }
        .task { await load(dir: "") }
        .sheet(item: $fileToView) { entry in
            NavigationStack {
                FileContentView(domainName: domainName, entry: entry, content: fileContent, error: errorMessage)
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Delete file?", isPresented: Binding(
            get: { fileToDelete != nil },
            set: { if !$0 { fileToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let entry = fileToDelete { Task { await deleteFile(entry) } }
            }
            Button("Cancel", role: .cancel) { fileToDelete = nil }
        }
        .preferredColorScheme(.dark)
    }

    private var breadcrumbs: [FileBreadcrumb] { listing?.breadcrumbs ?? [] }

    private var entries: [DomainFileEntry] {
        (listing?.entries ?? []).sorted { lhs, rhs in
            if lhs.isDirectory != rhs.isDirectory { return lhs.isDirectory }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func fileRow(_ entry: DomainFileEntry) -> some View {
        HStack(spacing: 12) {
            Image(systemName: entry.isDirectory ? "folder.fill" : "doc.text.fill")
                .foregroundStyle(entry.isDirectory ? Color.yellow : QadbakPalette.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name).font(.subheadline.weight(.medium)).foregroundStyle(QadbakPalette.text)
                if let size = entry.size, !size.isEmpty {
                    Text(size).font(.caption).foregroundStyle(QadbakPalette.muted)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(QadbakPalette.muted.opacity(0.5))
        }
        .padding(12)
        .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func load(dir: String) async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            listing = try await api.listFiles(domainName, dir: dir)
            currentDir = dir
        } catch { errorMessage = error.localizedDescription }
    }

    private func openDir(_ path: String) async { await load(dir: path) }

    private func openFile(_ entry: DomainFileEntry) async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            fileContent = try await api.readFile(domainName, path: entry.path)
            fileToView = entry
        } catch { errorMessage = error.localizedDescription }
    }

    private func deleteFile(_ entry: DomainFileEntry) async {
        guard let api = appState.api else { return }
        do {
            try await api.deleteFile(domainName, path: entry.path)
            fileToDelete = nil
            await load(dir: currentDir)
        } catch {
            errorMessage = error.localizedDescription
            fileToDelete = nil
        }
    }
}

private struct FileContentView: View {
    let domainName: String
    let entry: DomainFileEntry
    let content: DomainFileContent?
    let error: String?

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            if let content {
                ScrollView {
                    Text(content.content)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(QadbakPalette.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .textSelection(.enabled)
                }
            } else if let error {
                QBEmptyState(title: "Could not open", message: error, icon: "doc")
            } else {
                ProgressView().tint(QadbakPalette.accent)
            }
        }
        .navigationTitle(entry.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

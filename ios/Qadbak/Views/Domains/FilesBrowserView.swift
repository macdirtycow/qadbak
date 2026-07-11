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
        Group {
            if isLoading && listing == nil {
                ProgressView("Loading files…")
            } else if let errorMessage, listing == nil {
                ContentUnavailableView(
                    "Files unavailable",
                    systemImage: "folder.badge.questionmark",
                    description: Text(errorMessage)
                )
            } else {
                List {
                    if !breadcrumbs.isEmpty {
                        Section {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 4) {
                                    ForEach(breadcrumbs, id: \.path) { crumb in
                                        Button(crumb.label.isEmpty ? "Home" : crumb.label) {
                                            Task { await openDir(crumb.path) }
                                        }
                                        .buttonStyle(.borderless)
                                        if crumb.path != breadcrumbs.last?.path {
                                            Image(systemName: "chevron.right")
                                                .font(.caption2)
                                                .foregroundStyle(.tertiary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Section("Contents") {
                        ForEach(entries) { entry in
                            if entry.isDirectory {
                                Button {
                                    Task { await openDir(entry.path) }
                                } label: {
                                    FileRow(entry: entry)
                                }
                            } else {
                                Button {
                                    Task { await openFile(entry) }
                                } label: {
                                    FileRow(entry: entry)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    if entry.deletable != false {
                                        Button("Delete", role: .destructive) {
                                            fileToDelete = entry
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Files")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load(dir: currentDir) }
        .task { await load(dir: "") }
        .sheet(item: $fileToView) { entry in
            NavigationStack {
                FileContentView(
                    domainName: domainName,
                    entry: entry,
                    content: fileContent,
                    error: errorMessage
                )
            }
        }
        .confirmationDialog(
            "Delete file?",
            isPresented: Binding(
                get: { fileToDelete != nil },
                set: { if !$0 { fileToDelete = nil } }
            )
        ) {
            Button("Delete", role: .destructive) {
                if let entry = fileToDelete {
                    Task { await deleteFile(entry) }
                }
            }
            Button("Cancel", role: .cancel) { fileToDelete = nil }
        }
    }

    private var breadcrumbs: [FileBreadcrumb] {
        listing?.breadcrumbs ?? []
    }

    private var entries: [DomainFileEntry] {
        (listing?.entries ?? []).sorted { lhs, rhs in
            if lhs.isDirectory != rhs.isDirectory { return lhs.isDirectory }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func load(dir: String) async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            listing = try await api.listFiles(domainName, dir: dir)
            currentDir = dir
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func openDir(_ path: String) async {
        await load(dir: path)
    }

    private func openFile(_ entry: DomainFileEntry) async {
        guard let api = appState.api else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            fileContent = try await api.readFile(domainName, path: entry.path)
            fileToView = entry
        } catch {
            errorMessage = error.localizedDescription
        }
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

private struct FileRow: View {
    let entry: DomainFileEntry

    var body: some View {
        HStack {
            Image(systemName: entry.isDirectory ? "folder.fill" : "doc.text")
                .foregroundStyle(entry.isDirectory ? .yellow : QadbakTheme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.body)
                if let size = entry.size, !size.isEmpty {
                    Text(size)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct FileContentView: View {
    let domainName: String
    let entry: DomainFileEntry
    let content: DomainFileContent?
    let error: String?

    var body: some View {
        Group {
            if let content {
                ScrollView {
                    Text(content.content)
                        .font(.system(.body, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .textSelection(.enabled)
                }
            } else if let error {
                ContentUnavailableView("Could not open file", systemImage: "doc", description: Text(error))
            } else {
                ProgressView()
            }
        }
        .navigationTitle(entry.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
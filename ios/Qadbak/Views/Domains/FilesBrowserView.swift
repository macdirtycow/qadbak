import SwiftUI
import UniformTypeIdentifiers

struct FilesBrowserView: View {
    @Environment(AppState.self) private var appState
    let domainName: String

    @State private var listing: DomainFilesListing?
    @State private var currentDir = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var fileToView: DomainFileEntry?
    @State private var fileContent: DomainFileContent?
    @State private var entryToDelete: DomainFileEntry?
    @State private var entryToRename: DomainFileEntry?
    @State private var entryToMove: DomainFileEntry?
    @State private var showNewFolder = false
    @State private var showNewFile = false
    @State private var showUploadPicker = false
    @State private var isUploading = false
    @State private var newItemName = ""
    @State private var renameName = ""
    @State private var moveDestDir = ""
    @State private var moveNewName = ""

    private var writable: Bool { listing?.writable != false }

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
                            if let successMessage {
                                SuccessBanner(message: successMessage)
                            }
                            if let errorMessage {
                                ErrorBanner(message: errorMessage)
                            }
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
                                        .contextMenu { entryMenu(entry) }
                                } else {
                                    Button { Task { await openFile(entry) } } label: { fileRow(entry) }
                                        .buttonStyle(.plain)
                                        .contextMenu { entryMenu(entry) }
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
            if isUploading {
                Color.black.opacity(0.35).ignoresSafeArea()
                ProgressView("Uploading…")
                    .padding(24)
                    .background(QadbakPalette.card, in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .navigationTitle("Files")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(QadbakPalette.bg, for: .navigationBar)
        .toolbar {
            if writable {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { showUploadPicker = true } label: {
                            Label("Upload files", systemImage: "square.and.arrow.up")
                        }
                        Button { showNewFolder = true } label: {
                            Label("New folder", systemImage: "folder.badge.plus")
                        }
                        Button { showNewFile = true } label: {
                            Label("New file", systemImage: "doc.badge.plus")
                        }
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(QadbakPalette.accent)
                    }
                }
            }
        }
        .refreshable { await load(dir: currentDir) }
        .task { await load(dir: "") }
        .fileImporter(
            isPresented: $showUploadPicker,
            allowedContentTypes: [.item],
            allowsMultipleSelection: true
        ) { result in
            Task { await handleUpload(result) }
        }
        .sheet(item: $fileToView) { entry in
            NavigationStack {
                FileContentView(domainName: domainName, entry: entry, content: fileContent, error: errorMessage)
            }
            .preferredColorScheme(.dark)
        }
        .alert("New folder", isPresented: $showNewFolder) {
            TextField("Folder name", text: $newItemName)
            Button("Create") { Task { await createFolder() } }
            Button("Cancel", role: .cancel) { newItemName = "" }
        }
        .alert("New file", isPresented: $showNewFile) {
            TextField("File name", text: $newItemName)
            Button("Create") { Task { await createFile() } }
            Button("Cancel", role: .cancel) { newItemName = "" }
        }
        .alert("Rename", isPresented: Binding(
            get: { entryToRename != nil },
            set: { if !$0 { entryToRename = nil } }
        )) {
            TextField("New name", text: $renameName)
            Button("Rename") { Task { await renameEntry() } }
            Button("Cancel", role: .cancel) { entryToRename = nil }
        }
        .alert("Move to folder", isPresented: Binding(
            get: { entryToMove != nil },
            set: { if !$0 { entryToMove = nil } }
        )) {
            TextField("Destination folder", text: $moveDestDir)
            TextField("New name (optional)", text: $moveNewName)
            Button("Move") { Task { await moveEntry() } }
            Button("Cancel", role: .cancel) { entryToMove = nil }
        } message: {
            Text("Path relative to home, e.g. public_html or public_html/blog")
        }
        .confirmationDialog("Delete?", isPresented: Binding(
            get: { entryToDelete != nil },
            set: { if !$0 { entryToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let entry = entryToDelete { Task { await deleteEntry(entry) } }
            }
            Button("Cancel", role: .cancel) { entryToDelete = nil }
        } message: {
            Text(entryToDelete?.name ?? "")
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func entryMenu(_ entry: DomainFileEntry) -> some View {
        if !entry.isDirectory {
            Button("Open") { Task { await openFile(entry) } }
        }
        if writable && entry.canMove {
            Button("Rename") {
                entryToRename = entry
                renameName = entry.name
            }
            Button("Move…") {
                entryToMove = entry
                moveDestDir = currentDir
                moveNewName = ""
            }
        }
        if entry.canDelete {
            Button("Delete", role: .destructive) { entryToDelete = entry }
        }
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
        guard let hosting = appState.hostingAPI else {
            errorMessage = "Files are not available on this server."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            listing = try await hosting.listFiles(domainName, dir: dir)
            currentDir = dir
        } catch { errorMessage = error.localizedDescription }
    }

    private func openDir(_ path: String) async { await load(dir: path) }

    private func openFile(_ entry: DomainFileEntry) async {
        guard let hosting = appState.hostingAPI else {
            errorMessage = "Files are not available on this server."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            fileContent = try await hosting.readFile(domainName, path: entry.path)
            fileToView = entry
        } catch { errorMessage = error.localizedDescription }
    }

    private func deleteEntry(_ entry: DomainFileEntry) async {
        guard let hosting = appState.hostingAPI else {
            errorMessage = "Files are not available on this server."
            return
        }
        do {
            try await hosting.deleteFile(domainName, path: entry.path)
            entryToDelete = nil
            successMessage = "Deleted \(entry.name)."
            await load(dir: currentDir)
        } catch {
            errorMessage = error.localizedDescription
            entryToDelete = nil
        }
    }

    private func createFolder() async {
        guard let hosting = appState.hostingAPI, !newItemName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let name = newItemName.trimmingCharacters(in: .whitespaces)
        newItemName = ""
        showNewFolder = false
        do {
            try await hosting.mkdir(domainName, parent: currentDir, name: name)
            successMessage = "Created folder \(name)."
            await load(dir: currentDir)
        } catch { errorMessage = error.localizedDescription }
    }

    private func createFile() async {
        guard let hosting = appState.hostingAPI, !newItemName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let name = newItemName.trimmingCharacters(in: .whitespaces)
        newItemName = ""
        showNewFile = false
        do {
            try await hosting.createFile(domainName, parent: currentDir, name: name, content: "")
            successMessage = "Created \(name)."
            await load(dir: currentDir)
        } catch { errorMessage = error.localizedDescription }
    }

    private func renameEntry() async {
        guard let hosting = appState.hostingAPI, let entry = entryToRename else { return }
        let name = renameName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, name != entry.name else { return }
        do {
            try await hosting.moveFile(domainName, path: entry.path, destDir: nil, newName: name, overwrite: false)
            entryToRename = nil
            successMessage = "Renamed to \(name)."
            await load(dir: currentDir)
        } catch {
            errorMessage = error.localizedDescription
            entryToRename = nil
        }
    }

    private func moveEntry() async {
        guard let hosting = appState.hostingAPI, let entry = entryToMove else { return }
        let dest = moveDestDir.trimmingCharacters(in: .whitespaces)
        let newName = moveNewName.trimmingCharacters(in: .whitespaces)
        do {
            try await hosting.moveFile(
                domainName,
                path: entry.path,
                destDir: dest.isEmpty ? nil : dest,
                newName: newName.isEmpty ? nil : newName,
                overwrite: false
            )
            entryToMove = nil
            successMessage = "Moved \(entry.name)."
            await load(dir: currentDir)
        } catch {
            errorMessage = error.localizedDescription
            entryToMove = nil
        }
    }

    private func handleUpload(_ result: Result<[URL], Error>) async {
        guard let hosting = appState.hostingAPI else {
            errorMessage = "Files are not available on this server."
            return
        }
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard !urls.isEmpty else { return }
            isUploading = true
            defer { isUploading = false }
            var payloads: [(name: String, data: Data, mimeType: String)] = []
            for url in urls {
                guard url.startAccessingSecurityScopedResource() else { continue }
                defer { url.stopAccessingSecurityScopedResource() }
                do {
                    let data = try Data(contentsOf: url)
                    let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                    payloads.append((name: url.lastPathComponent, data: data, mimeType: mime))
                } catch {
                    errorMessage = error.localizedDescription
                    return
                }
            }
            do {
                let res = try await hosting.uploadFiles(domainName, dir: currentDir, files: payloads, overwrite: true)
                successMessage = "Uploaded \(res.uploaded?.count ?? payloads.count) file(s)."
                await load(dir: currentDir)
            } catch { errorMessage = error.localizedDescription }
        }
    }
}

private struct FileContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let domainName: String
    let entry: DomainFileEntry
    @State var content: DomainFileContent?
    @State var error: String?

    @State private var editedText = ""
    @State private var isSaving = false
    @State private var saveMessage: String?

    private var canEdit: Bool {
        entry.editable != false && content?.readOnly != true
    }

    var body: some View {
        ZStack {
            QadbakPalette.bg.ignoresSafeArea()
            if let content {
                VStack(spacing: 0) {
                    if canEdit {
                        TextEditor(text: $editedText)
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(QadbakPalette.text)
                            .scrollContentBackground(.hidden)
                            .padding(12)
                    } else {
                        ScrollView {
                            Text(content.content)
                                .font(.system(.body, design: .monospaced))
                                .foregroundStyle(QadbakPalette.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .textSelection(.enabled)
                        }
                    }
                    if let saveMessage {
                        SuccessBanner(message: saveMessage).padding()
                    }
                    if let error {
                        ErrorBanner(message: error).padding()
                    }
                    if canEdit {
                        QBPrimaryButton(title: "Save", loading: isSaving, disabled: editedText == content.content) {
                            Task { await save() }
                        }
                        .padding()
                    }
                }
            } else if let error {
                QBEmptyState(title: "Could not open", message: error, icon: "doc")
            } else {
                ProgressView().tint(QadbakPalette.accent)
            }
        }
        .navigationTitle(entry.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let content {
                editedText = content.content
            }
        }
    }

    private func save() async {
        guard let hosting = appState.hostingAPI else {
            error = "Files are not available on this server."
            return
        }
        isSaving = true
        error = nil
        saveMessage = nil
        defer { isSaving = false }
        do {
            try await hosting.saveFile(domainName, path: entry.path, content: editedText)
            content = DomainFileContent(
                content: editedText,
                mime: content?.mime,
                language: content?.language,
                readOnly: content?.readOnly,
                encoding: content?.encoding
            )
            saveMessage = "Saved."
        } catch let err {
            self.error = err.localizedDescription
        }
    }
}

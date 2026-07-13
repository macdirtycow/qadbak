package panels

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

// Hestia domain files use panel-relative paths from /home/{owner}/.
// Writes are restricted to /home/{owner}/web/{domain}/.

type HestiaFilesScope struct {
	Owner    string
	Domain   string
	Home     string // /home/{owner}
	Sandbox  string // /home/{owner}/web/{domain}
	DefaultCwd string // web/{domain}/public_html
}

type HestiaFileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"`
	Size        string `json:"size,omitempty"`
	Modified    string `json:"modified,omitempty"`
	Editable    bool   `json:"editable,omitempty"`
	Deletable   bool   `json:"deletable,omitempty"`
	Downloadable bool  `json:"downloadable,omitempty"`
	Movable     bool   `json:"movable,omitempty"`
}

type HestiaFilesListing struct {
	Mode         string              `json:"mode"`
	Home         string              `json:"home"`
	Cwd          string              `json:"cwd"`
	Breadcrumbs  []HestiaBreadcrumb  `json:"breadcrumbs"`
	Entries      []HestiaFileEntry   `json:"entries,omitempty"`
	Writable     bool                `json:"writable"`
}

type HestiaBreadcrumb struct {
	Label string `json:"label"`
	Path  string `json:"path"`
}

type HestiaFileContent struct {
	Content  string `json:"content"`
	Mime     string `json:"mime,omitempty"`
	Language string `json:"language,omitempty"`
	ReadOnly bool   `json:"readOnly"`
	Encoding string `json:"encoding"`
}

func HestiaFilesScopeForDomain(cfg LinkConfig, domain string) (HestiaFilesScope, error) {
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return HestiaFilesScope{}, err
	}
	if owner == "" {
		return HestiaFilesScope{}, fmt.Errorf("domain owner not found")
	}
	home := filepath.Join("/home", owner)
	sandbox := filepath.Join(home, "web", domain)
	defaultCwd := filepath.ToSlash(filepath.Join("web", domain, "public_html"))
	return HestiaFilesScope{
		Owner:        owner,
		Domain:       domain,
		Home:         home,
		Sandbox:      sandbox,
		DefaultCwd:   defaultCwd,
	}, nil
}

func HestiaListFiles(cfg LinkConfig, domain, dir string) (HestiaFilesListing, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return HestiaFilesListing{}, err
	}
	cwd, err := scope.normalizeDir(dir)
	if err != nil {
		return HestiaFilesListing{}, err
	}
	abs, err := scope.absFromPanel(cwd)
	if err != nil {
		return HestiaFilesListing{}, err
	}
	raw, err := privilege.DomainFSList(abs)
	if err != nil {
		return HestiaFilesListing{}, err
	}
	writable := scope.isWritable(cwd)
	entries := make([]HestiaFileEntry, 0, len(raw))
	for _, e := range raw {
		panelPath := cwd
		if panelPath != "" {
			panelPath += "/"
		}
		panelPath += e.Name
		panelPath = strings.TrimPrefix(filepath.ToSlash(panelPath), "/")
		item := HestiaFileEntry{
			Name:         e.Name,
			Path:         panelPath,
			Type:         e.Type,
			Modified:     e.Modified,
			Downloadable: e.Type != "dir",
			Movable:      writable,
			Deletable:    writable && e.Type != "dir",
		}
		if e.SizeBytes > 0 {
			item.Size = formatFileSize(e.SizeBytes)
		}
		if e.Type != "dir" && privilege.IsTextFileName(e.Name) && writable {
			item.Editable = true
		}
		entries = append(entries, item)
	}
	return HestiaFilesListing{
		Mode:        "hestia",
		Home:        scope.Home,
		Cwd:         cwd,
		Breadcrumbs: scope.breadcrumbs(cwd),
		Entries:     entries,
		Writable:    writable,
	}, nil
}

func HestiaReadFile(cfg LinkConfig, domain, panelPath string) (HestiaFileContent, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return HestiaFileContent{}, err
	}
	safe, err := scope.safePanelPath(panelPath)
	if err != nil {
		return HestiaFileContent{}, err
	}
	abs, err := scope.absFromPanel(safe)
	if err != nil {
		return HestiaFileContent{}, err
	}
	content, encoding, _, err := privilege.DomainFSRead(abs)
	if err != nil {
		return HestiaFileContent{}, err
	}
	parent := parentPanelPath(safe)
	return HestiaFileContent{
		Content:  content,
		Mime:     mimeForFileName(filepath.Base(safe)),
		Language: languageForFileName(filepath.Base(safe)),
		ReadOnly: !scope.isWritable(parent),
		Encoding: encoding,
	}, nil
}

func HestiaWriteFile(cfg LinkConfig, domain, panelPath, content string) error {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return err
	}
	safe, err := scope.safePanelPath(panelPath)
	if err != nil {
		return err
	}
	if !privilege.IsTextFileName(filepath.Base(safe)) {
		return fmt.Errorf("cannot edit this file type as text")
	}
	if !scope.isWritable(parentPanelPath(safe)) {
		return fmt.Errorf("directory is read-only")
	}
	abs, err := scope.absFromPanel(safe)
	if err != nil {
		return err
	}
	return privilege.DomainFSWrite(abs, content)
}

func HestiaMkdir(cfg LinkConfig, domain, parent, name string) (string, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return "", err
	}
	parentNorm, err := scope.normalizeParent(parent)
	if err != nil {
		return "", err
	}
	if !scope.isWritable(parentNorm) {
		return "", fmt.Errorf("directory is read-only")
	}
	safeName := safeFileName(name)
	if safeName == "" {
		return "", fmt.Errorf("invalid folder name")
	}
	panelPath := parentNorm
	if panelPath != "" {
		panelPath += "/"
	}
	panelPath += safeName
	abs, err := scope.absFromPanel(panelPath)
	if err != nil {
		return "", err
	}
	if err := privilege.DomainFSMkdir(abs); err != nil {
		return "", err
	}
	return panelPath, nil
}

func HestiaCreateFile(cfg LinkConfig, domain, parent, name, content string) (string, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return "", err
	}
	parentNorm, err := scope.normalizeParent(parent)
	if err != nil {
		return "", err
	}
	if !scope.isWritable(parentNorm) {
		return "", fmt.Errorf("directory is read-only")
	}
	safeName := safeFileName(name)
	if safeName == "" {
		return "", fmt.Errorf("invalid file name")
	}
	panelPath := parentNorm
	if panelPath != "" {
		panelPath += "/"
	}
	panelPath += safeName
	abs, err := scope.absFromPanel(panelPath)
	if err != nil {
		return "", err
	}
	if err := privilege.DomainFSWrite(abs, content); err != nil {
		return "", err
	}
	return panelPath, nil
}

func HestiaDeleteFile(cfg LinkConfig, domain, panelPath string) error {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return err
	}
	safe, err := scope.safePanelPath(panelPath)
	if err != nil {
		return err
	}
	if !scope.isWritable(parentPanelPath(safe)) {
		return fmt.Errorf("directory is read-only")
	}
	abs, err := scope.absFromPanel(safe)
	if err != nil {
		return err
	}
	return privilege.DomainFSDelete(abs)
}

func HestiaMoveFile(cfg LinkConfig, domain, panelPath, destDir, newName string, overwrite bool) (string, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return "", err
	}
	safe, err := scope.safePanelPath(panelPath)
	if err != nil {
		return "", err
	}
	if !scope.isWritable(parentPanelPath(safe)) {
		return "", fmt.Errorf("source directory is read-only")
	}
	destParent := parentPanelPath(safe)
	if strings.TrimSpace(destDir) != "" {
		destParent, err = scope.normalizeDir(destDir)
		if err != nil {
			return "", err
		}
	}
	if !scope.isWritable(destParent) {
		return "", fmt.Errorf("destination directory is read-only")
	}
	finalName := filepath.Base(safe)
	if strings.TrimSpace(newName) != "" {
		finalName = safeFileName(newName)
		if finalName == "" {
			return "", fmt.Errorf("invalid name")
		}
	}
	destPanel := destParent
	if destPanel != "" {
		destPanel += "/"
	}
	destPanel += finalName
	srcAbs, err := scope.absFromPanel(safe)
	if err != nil {
		return "", err
	}
	destAbs, err := scope.absFromPanel(destPanel)
	if err != nil {
		return "", err
	}
	if !overwrite {
		if _, statErr := os.Stat(destAbs); statErr == nil {
			return "", fmt.Errorf("destination already exists")
		}
	}
	if err := privilege.DomainFSMove(srcAbs, destAbs); err != nil {
		return "", err
	}
	return destPanel, nil
}

func HestiaUploadFile(cfg LinkConfig, domain, dir, filename string, data []byte, overwrite bool) (string, error) {
	scope, err := HestiaFilesScopeForDomain(cfg, domain)
	if err != nil {
		return "", err
	}
	cwd, err := scope.normalizeDir(dir)
	if err != nil {
		return "", err
	}
	if !scope.isWritable(cwd) {
		return "", fmt.Errorf("directory is read-only")
	}
	safeName := safeFileName(filename)
	if safeName == "" {
		return "", fmt.Errorf("invalid filename")
	}
	panelPath := cwd
	if panelPath != "" {
		panelPath += "/"
	}
	panelPath += safeName
	absDir, err := scope.absFromPanel(cwd)
	if err != nil {
		return "", err
	}
	targetAbs, err := scope.absFromPanel(panelPath)
	if err != nil {
		return "", err
	}
	if !overwrite {
		if _, statErr := os.Stat(targetAbs); statErr == nil {
			return "", fmt.Errorf("file already exists")
		}
	}
	if err := privilege.DomainFSUpload(absDir, safeName, data); err != nil {
		return "", err
	}
	return panelPath, nil
}

func (s HestiaFilesScope) normalizeParent(parent string) (string, error) {
	cwd := strings.Trim(strings.TrimSpace(parent), "/")
	if cwd == "" {
		cwd = s.DefaultCwd
	}
	return s.safePanelPath(cwd)
}

func (s HestiaFilesScope) normalizeDir(dir string) (string, error) {
	cwd := strings.Trim(strings.TrimSpace(dir), "/")
	if cwd == "" {
		cwd = s.DefaultCwd
	}
	return s.safePanelPath(cwd)
}

func (s HestiaFilesScope) safePanelPath(panelPath string) (string, error) {
	rel := strings.Trim(strings.TrimSpace(panelPath), "/")
	if strings.Contains(rel, "..") {
		return "", fmt.Errorf("invalid path")
	}
	prefix := filepath.ToSlash(filepath.Join("web", s.Domain))
	if rel == "" {
		return s.DefaultCwd, nil
	}
	if rel != prefix && !strings.HasPrefix(rel, prefix+"/") {
		return "", fmt.Errorf("path outside domain web root")
	}
	return rel, nil
}

func (s HestiaFilesScope) absFromPanel(panelPath string) (string, error) {
	safe, err := s.safePanelPath(panelPath)
	if err != nil {
		return "", err
	}
	abs := filepath.Join(s.Home, filepath.FromSlash(safe))
	clean := filepath.Clean(abs)
	if !strings.HasPrefix(clean, s.Sandbox) && clean != s.Sandbox {
		return "", fmt.Errorf("path outside domain sandbox")
	}
	return clean, nil
}

func (s HestiaFilesScope) isWritable(panelPath string) bool {
	safe, err := s.safePanelPath(panelPath)
	if err != nil {
		return false
	}
	prefix := filepath.ToSlash(filepath.Join("web", s.Domain))
	return safe == prefix || strings.HasPrefix(safe, prefix+"/")
}

func (s HestiaFilesScope) breadcrumbs(cwd string) []HestiaBreadcrumb {
	parts := strings.Split(cwd, "/")
	out := make([]HestiaBreadcrumb, 0, len(parts))
	acc := ""
	for _, part := range parts {
		if part == "" {
			continue
		}
		if acc == "" {
			acc = part
		} else {
			acc += "/" + part
		}
		out = append(out, HestiaBreadcrumb{Label: part, Path: acc})
	}
	return out
}

func parentPanelPath(panelPath string) string {
	panelPath = strings.Trim(panelPath, "/")
	if !strings.Contains(panelPath, "/") {
		return ""
	}
	return panelPath[:strings.LastIndex(panelPath, "/")]
}

func safeFileName(name string) string {
	s := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(name, "/", ""), "\\", ""))
	if s == "" || s == "." || s == ".." || strings.Contains(s, "..") {
		return ""
	}
	return s
}

func formatFileSize(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	exp := 0
	for n >= unit && exp < 4 {
		n /= unit
		exp++
	}
	suffix := []string{"KB", "MB", "GB", "TB"}
	return fmt.Sprintf("%d %s", n, suffix[exp-1])
}

func mimeForFileName(name string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	switch ext {
	case "html", "htm":
		return "text/html"
	case "css":
		return "text/css"
	case "js", "mjs":
		return "text/javascript"
	case "json":
		return "application/json"
	case "svg":
		return "image/svg+xml"
	case "php":
		return "application/x-php"
	default:
		return "text/plain"
	}
}

func languageForFileName(name string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	switch ext {
	case "html", "htm":
		return "html"
	case "css":
		return "css"
	case "js", "mjs":
		return "javascript"
	case "json":
		return "json"
	case "md":
		return "markdown"
	case "php":
		return "php"
	default:
		return "plaintext"
	}
}

// ParseFSListOutput decodes priv list JSON (tests).
func ParseFSListOutput(raw []byte) ([]HestiaFileEntry, error) {
	var envelope struct {
		OK      bool `json:"ok"`
		Entries []struct {
			Name      string `json:"name"`
			Type      string `json:"type"`
			SizeBytes int64  `json:"sizeBytes"`
			Modified  string `json:"modified"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	out := make([]HestiaFileEntry, 0, len(envelope.Entries))
	for _, e := range envelope.Entries {
		out = append(out, HestiaFileEntry{Name: e.Name, Type: e.Type, Modified: e.Modified})
	}
	return out, nil
}

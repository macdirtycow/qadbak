package privilege

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	maxFSReadBytes   = 5 * 1024 * 1024
	maxFSWriteBytes  = 10 * 1024 * 1024
	maxFSUploadBytes = 100 * 1024 * 1024
)

var textExtensions = map[string]bool{
	"html": true, "htm": true, "css": true, "js": true, "mjs": true, "json": true,
	"txt": true, "md": true, "xml": true, "svg": true, "php": true, "cgi": true,
	"sh": true, "py": true, "yml": true, "yaml": true, "env": true, "htaccess": true,
	"conf": true, "ini": true, "log": true,
}

type fsEntry struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	SizeBytes int64  `json:"sizeBytes,omitempty"`
	Modified  string `json:"modified,omitempty"`
}

func DomainFSList(absPath string) ([]fsEntry, error) {
	resolved, err := assertHomePath(absPath)
	if err != nil {
		return nil, err
	}
	if os.Geteuid() == 0 {
		return domainFSList(resolved)
	}
	out, err := Run([]string{"domain-fs", "list", resolved})
	if err != nil {
		return nil, err
	}
	return parseFSEntries(out)
}

func DomainFSRead(absPath string) (content string, encoding string, size int64, err error) {
	resolved, err := assertHomePath(absPath)
	if err != nil {
		return "", "", 0, err
	}
	if os.Geteuid() == 0 {
		return domainFSRead(resolved)
	}
	out, err := Run([]string{"domain-fs", "read", resolved})
	if err != nil {
		return "", "", 0, err
	}
	var envelope struct {
		OK        bool   `json:"ok"`
		Content   string `json:"content"`
		Encoding  string `json:"encoding"`
		SizeBytes int64  `json:"sizeBytes"`
	}
	if json.Unmarshal(out, &envelope) != nil || !envelope.OK {
		return "", "", 0, fmt.Errorf("read failed")
	}
	return envelope.Content, envelope.Encoding, envelope.SizeBytes, nil
}

func DomainFSWrite(absPath, content string) error {
	resolved, err := assertHomePath(absPath)
	if err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		return domainFSWrite(resolved, content)
	}
	encoded := base64.StdEncoding.EncodeToString([]byte(content))
	_, err = Run([]string{"domain-fs", "write", resolved, encoded})
	return err
}

func DomainFSMkdir(absPath string) error {
	resolved, err := assertHomePath(absPath)
	if err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		return domainFSMkdir(resolved)
	}
	_, err = Run([]string{"domain-fs", "mkdir", resolved})
	return err
}

func DomainFSDelete(absPath string) error {
	resolved, err := assertHomePath(absPath)
	if err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		return domainFSDelete(resolved)
	}
	_, err = Run([]string{"domain-fs", "delete", resolved})
	return err
}

func DomainFSMove(srcAbs, destAbs string) error {
	src, err := assertHomePath(srcAbs)
	if err != nil {
		return err
	}
	dest, err := assertHomePath(destAbs)
	if err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		return domainFSMove(src, dest)
	}
	_, err = Run([]string{"domain-fs", "move", src, dest})
	return err
}

func DomainFSUpload(dirAbs, name string, data []byte) error {
	dir, err := assertHomePath(dirAbs)
	if err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		return domainFSUpload(dir, name, data)
	}
	encoded := base64.StdEncoding.EncodeToString(data)
	_, err = Run([]string{"domain-fs", "upload", dir, name, encoded})
	return err
}

func privDomainFS(args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("invalid domain-fs invocation")
	}
	switch args[0] {
	case "list":
		entries, err := domainFSList(args[1])
		if err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true, "entries": entries})
	case "read":
		content, enc, size, err := domainFSRead(args[1])
		if err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true, "content": content, "encoding": enc, "sizeBytes": size})
	case "write":
		if len(args) < 3 {
			return fmt.Errorf("invalid write invocation")
		}
		raw, err := base64.StdEncoding.DecodeString(args[2])
		if err != nil {
			return fmt.Errorf("invalid write payload")
		}
		if err := domainFSWrite(args[1], string(raw)); err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true})
	case "mkdir":
		if err := domainFSMkdir(args[1]); err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true})
	case "delete":
		if err := domainFSDelete(args[1]); err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true})
	case "move":
		if len(args) < 3 {
			return fmt.Errorf("invalid move invocation")
		}
		if err := domainFSMove(args[1], args[2]); err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true})
	case "upload":
		if len(args) < 4 {
			return fmt.Errorf("invalid upload invocation")
		}
		data, err := base64.StdEncoding.DecodeString(args[3])
		if err != nil {
			return fmt.Errorf("invalid upload payload")
		}
		if err := domainFSUpload(args[1], args[2], data); err != nil {
			return err
		}
		return emitJSON(map[string]any{"ok": true})
	default:
		return fmt.Errorf("unknown domain-fs command")
	}
}

func domainFSList(resolved string) ([]fsEntry, error) {
	st, err := os.Stat(resolved)
	if err != nil {
		return nil, err
	}
	if !st.IsDir() {
		return nil, fmt.Errorf("not a directory")
	}
	names, err := os.ReadDir(resolved)
	if err != nil {
		return nil, err
	}
	out := make([]fsEntry, 0, len(names))
	for _, ent := range names {
		name := ent.Name()
		if name == "." || name == ".." {
			continue
		}
		info, err := ent.Info()
		if err != nil {
			continue
		}
		item := fsEntry{Name: name}
		if info.IsDir() {
			item.Type = "dir"
		} else {
			item.Type = "file"
			item.SizeBytes = info.Size()
		}
		item.Modified = info.ModTime().UTC().Format("2006-01-02")
		out = append(out, item)
	}
	return out, nil
}

func domainFSRead(resolved string) (string, string, int64, error) {
	st, err := os.Stat(resolved)
	if err != nil {
		return "", "", 0, err
	}
	if st.IsDir() {
		return "", "", 0, fmt.Errorf("not a file")
	}
	if st.Size() > maxFSReadBytes {
		return "", "", 0, fmt.Errorf("file too large")
	}
	data, err := os.ReadFile(resolved)
	if err != nil {
		return "", "", 0, err
	}
	base := filepath.Base(resolved)
	if isTextFileName(base) {
		return string(data), "text", st.Size(), nil
	}
	for _, b := range data {
		if b == 0 {
			return base64.StdEncoding.EncodeToString(data), "base64", st.Size(), nil
		}
	}
	return string(data), "text", st.Size(), nil
}

func domainFSWrite(resolved, content string) error {
	if len(content) > maxFSWriteBytes {
		return fmt.Errorf("file too large")
	}
	parent := filepath.Dir(resolved)
	if _, err := assertHomePath(parent); err != nil {
		return err
	}
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(resolved, []byte(content), 0o644); err != nil {
		return err
	}
	chownToHomeUser(resolved)
	return nil
}

func domainFSMkdir(resolved string) error {
	parent := filepath.Dir(resolved)
	if _, err := assertHomePath(parent); err != nil {
		return err
	}
	if err := os.Mkdir(resolved, 0o755); err != nil {
		return err
	}
	chownToHomeUser(resolved)
	return nil
}

func domainFSDelete(resolved string) error {
	st, err := os.Stat(resolved)
	if err != nil {
		return err
	}
	if st.IsDir() {
		return os.RemoveAll(resolved)
	}
	return os.Remove(resolved)
}

func domainFSMove(src, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	if err := os.Rename(src, dest); err != nil {
		return err
	}
	chownToHomeUser(dest)
	return nil
}

func domainFSUpload(dir, name string, data []byte) error {
	if len(data) > maxFSUploadBytes {
		return fmt.Errorf("upload too large")
	}
	safe := safeBaseName(name)
	if safe == "" {
		return fmt.Errorf("invalid filename")
	}
	st, err := os.Stat(dir)
	if err != nil || !st.IsDir() {
		return fmt.Errorf("destination is not a directory")
	}
	target := filepath.Join(dir, safe)
	if _, err := assertHomePath(target); err != nil {
		return err
	}
	if err := os.WriteFile(target, data, 0o644); err != nil {
		return err
	}
	chownToHomeUser(target)
	return nil
}

func parseFSEntries(out []byte) ([]fsEntry, error) {
	line := strings.TrimSpace(string(out))
	if idx := strings.LastIndex(line, "\n"); idx >= 0 {
		line = strings.TrimSpace(line[idx+1:])
	}
	var envelope struct {
		OK      bool      `json:"ok"`
		Entries []fsEntry `json:"entries"`
	}
	if err := json.Unmarshal([]byte(line), &envelope); err != nil {
		return nil, err
	}
	if !envelope.OK {
		return nil, fmt.Errorf("list failed")
	}
	return envelope.Entries, nil
}

func assertHomePath(target string) (string, error) {
	clean := filepath.Clean(strings.TrimSpace(target))
	if clean == "" || !filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid path")
	}
	if clean != "/home" && !strings.HasPrefix(clean, "/home/") {
		return "", fmt.Errorf("path not allowed")
	}
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("invalid path")
	}
	existing, err := filepath.EvalSymlinks(clean)
	if err == nil {
		if existing != "/home" && !strings.HasPrefix(existing, "/home/") {
			return "", fmt.Errorf("path not allowed")
		}
		return existing, nil
	}
	parent := filepath.Dir(clean)
	parentResolved, perr := filepath.EvalSymlinks(parent)
	if perr != nil {
		return "", fmt.Errorf("path not found")
	}
	if parentResolved != "/home" && !strings.HasPrefix(parentResolved, "/home/") {
		return "", fmt.Errorf("path not allowed")
	}
	base := filepath.Base(clean)
	if base == "" || base == "." || base == ".." {
		return "", fmt.Errorf("invalid path")
	}
	return filepath.Join(parentResolved, base), nil
}

func safeBaseName(name string) string {
	safe := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(name, "/", ""), "\\", ""))
	if safe == "" || safe == "." || safe == ".." || strings.Contains(safe, "..") {
		return ""
	}
	return safe
}

func IsTextFileName(name string) bool {
	return isTextFileName(name)
}

func isTextFileName(name string) bool {
	if name == ".htaccess" || strings.HasPrefix(name, ".env") {
		return true
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	return textExtensions[ext]
}

func chownToHomeUser(target string) {
	resolved, err := filepath.EvalSymlinks(target)
	if err != nil {
		resolved = target
	}
	parts := strings.Split(strings.TrimPrefix(resolved, "/home/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		return
	}
	user := parts[0]
	_ = exec.Command("chown", user+":"+user, resolved).Run()
}

func emitJSON(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = os.Stdout.Write(append(b, '\n'))
	return err
}

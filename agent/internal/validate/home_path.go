package validate

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// HomeAbsPath resolves a path and ensures it stays under /home (web sandbox).
func HomeAbsPath(target string) (string, error) {
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

// HomeParentAbsPath validates a directory path under /home.
func HomeParentAbsPath(target string) (string, error) {
	return HomeAbsPath(target)
}

// HomeJoinFile joins a validated home directory with a sanitized basename.
func HomeJoinFile(dir, name string) (string, error) {
	safeDir, err := HomeAbsPath(dir)
	if err != nil {
		return "", err
	}
	safeName := SafeBaseName(name)
	if safeName == "" {
		return "", fmt.Errorf("invalid filename")
	}
	target := filepath.Join(safeDir, safeName)
	return HomeAbsPath(target)
}

// SafeBaseName returns a single path component safe for file operations.
func SafeBaseName(name string) string {
	safe := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(name, "/", ""), "\\", ""))
	if safe == "" || safe == "." || safe == ".." || strings.Contains(safe, "..") {
		return ""
	}
	return safe
}

// UpgradeStagingPath validates the agent self-upgrade staging binary path.
func UpgradeStagingPath(path string) (string, error) {
	const stagingBaseName = "qadbak-agent-staging"
	clean := filepath.Clean(strings.TrimSpace(path))
	if clean == "" || !filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid upgrade path")
	}
	if filepath.Base(clean) != stagingBaseName {
		return "", fmt.Errorf("invalid upgrade filename")
	}
	if !strings.Contains(clean, string(os.PathSeparator)+"upgrade"+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid upgrade directory")
	}
	return clean, nil
}

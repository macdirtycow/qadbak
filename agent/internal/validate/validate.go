package validate

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	serviceName    = regexp.MustCompile(`^[a-zA-Z0-9@._+-]+\.service$`)
	containerID    = regexp.MustCompile(`^[a-f0-9]{12,64}$`)
	backupFilename = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tar(\.gz)?$`)
)

func ServiceUnit(name string) bool {
	name = strings.TrimSpace(name)
	return serviceName.MatchString(name)
}

func ContainerID(id string) bool {
	id = strings.TrimSpace(strings.ToLower(id))
	return containerID.MatchString(id)
}

const BackupDir = "/backup"

func BackupFilename(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		return false
	}
	return backupFilename.MatchString(name)
}

// NormalizeBackupFilename returns a basename safe for backup download APIs.
func NormalizeBackupFilename(name string) (string, error) {
	base := strings.TrimSpace(name)
	if i := strings.LastIndexAny(base, "/\\"); i >= 0 {
		base = base[i+1:]
	}
	if !BackupFilename(base) {
		return "", fmt.Errorf("invalid backup filename")
	}
	return base, nil
}

// BackupAbsPath joins a validated backup basename with the fixed backup directory.
func BackupAbsPath(base string) (string, error) {
	if !BackupFilename(base) {
		return "", fmt.Errorf("invalid backup filename")
	}
	return BackupDir + "/" + base, nil
}

func LogSource(source string) bool {
	switch strings.TrimSpace(source) {
	case "journal", "service", "":
		return true
	default:
		return false
	}
}

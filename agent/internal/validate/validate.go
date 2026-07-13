package validate

import (
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

func BackupFilename(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		return false
	}
	return backupFilename.MatchString(name)
}

func LogSource(source string) bool {
	switch strings.TrimSpace(source) {
	case "journal", "service", "":
		return true
	default:
		return false
	}
}

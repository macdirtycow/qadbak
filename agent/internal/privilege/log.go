package privilege

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func LogTail(path string, lines int) (string, error) {
	clean, err := validateLogPath(path)
	if err != nil {
		return "", err
	}
	if lines <= 0 {
		lines = 200
	}
	if lines > 2000 {
		lines = 2000
	}
	out, err := Run([]string{"log-tail", clean, strconv.Itoa(lines)})
	return strings.TrimSpace(string(out)), err
}

func privLogTail(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("invalid log-tail invocation")
	}
	path, err := validateLogPath(args[0])
	if err != nil {
		return err
	}
	lines, err := strconv.Atoi(strings.TrimSpace(args[1]))
	if err != nil || lines <= 0 {
		return fmt.Errorf("invalid line count")
	}
	if lines > 2000 {
		lines = 2000
	}
	return RunSimple([]string{"/usr/bin/tail", "-n", strconv.Itoa(lines), path})
}

func validateLogPath(path string) (string, error) {
	clean := filepath.Clean(strings.TrimSpace(path))
	if clean == "" || !filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid log path")
	}
	if !strings.HasPrefix(clean, "/var/log/") {
		return "", fmt.Errorf("log path not allowed")
	}
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("invalid log path")
	}
	if _, err := os.Stat(clean); err != nil {
		return "", fmt.Errorf("log file not found")
	}
	return clean, nil
}

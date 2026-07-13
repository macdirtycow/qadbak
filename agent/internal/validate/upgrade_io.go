package validate

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

const (
	upgradeStagingName        = "qadbak-agent-staging"
	defaultAgentDataDir       = "/var/lib/qadbak-agent"
	defaultUpgradeStagingDir  = defaultAgentDataDir + "/upgrade"
	defaultUpgradeStagingFile = defaultUpgradeStagingDir + "/" + upgradeStagingName
)

// UpgradeStagingBinary validates and stats the agent upgrade staging binary.
func UpgradeStagingBinary(path string) (string, error) {
	if err := validateUpgradeStagingPathInput(path); err != nil {
		return "", err
	}
	info, err := fs.Stat(os.DirFS(defaultUpgradeStagingDir), upgradeStagingName)
	if err != nil {
		return "", fmt.Errorf("staging binary missing")
	}
	if info.Size() < 1024 {
		return "", fmt.Errorf("staging binary too small")
	}
	return defaultUpgradeStagingFile, nil
}

// RemoveUpgradeStaging removes a validated agent upgrade staging binary.
func RemoveUpgradeStaging(path string) error {
	if err := validateUpgradeStagingPathInput(path); err != nil {
		return err
	}
	resolved, err := filepath.EvalSymlinks(defaultUpgradeStagingFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("staging binary missing")
	}
	if resolved != defaultUpgradeStagingFile {
		return fmt.Errorf("invalid upgrade path")
	}
	if err := os.Remove(defaultUpgradeStagingFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove staging binary: %w", err)
	}
	return nil
}

func validateUpgradeStagingPathInput(path string) error {
	clean := filepath.Clean(strings.TrimSpace(path))
	if clean == "" || !filepath.IsAbs(clean) {
		return fmt.Errorf("invalid upgrade path")
	}
	if clean != defaultUpgradeStagingFile {
		return fmt.Errorf("invalid upgrade path")
	}
	resolved, err := filepath.EvalSymlinks(clean)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("staging binary missing")
	}
	if resolved != defaultUpgradeStagingFile {
		return fmt.Errorf("invalid upgrade path")
	}
	return nil
}

// resolveUpgradeStagingFile validates the canonical agent upgrade staging path.
func resolveUpgradeStagingFile(path string) (string, error) {
	if err := validateUpgradeStagingPathInput(path); err != nil {
		return "", err
	}
	return defaultUpgradeStagingFile, nil
}

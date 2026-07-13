package validate

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

const upgradeStagingName = "qadbak-agent-staging"

// UpgradeStagingBinary validates and stats the agent upgrade staging binary.
func UpgradeStagingBinary(path string) (string, error) {
	clean, err := UpgradeStagingPath(path)
	if err != nil {
		return "", err
	}
	root := filepath.Dir(clean)
	info, err := fs.Stat(os.DirFS(root), upgradeStagingName)
	if err != nil {
		return "", fmt.Errorf("staging binary missing")
	}
	if info.Size() < 1024 {
		return "", fmt.Errorf("staging binary too small")
	}
	return clean, nil
}

// RemoveUpgradeStaging removes a validated agent upgrade staging binary.
func RemoveUpgradeStaging(path string) error {
	clean, err := UpgradeStagingPath(path)
	if err != nil {
		return err
	}
	root := filepath.Dir(clean)
	target := filepath.Join(root, upgradeStagingName)
	if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove staging binary: %w", err)
	}
	return nil
}

package validate

import (
	"fmt"
	"os"
	"strings"
)

// OpenBackupFile opens a validated Hestia backup tarball under BackupDir.
func OpenBackupFile(name string) (*os.File, error) {
	base, err := NormalizeBackupFilename(name)
	if err != nil {
		return nil, err
	}
	if !backupFilename.MatchString(base) {
		return nil, fmt.Errorf("invalid backup filename")
	}
	if strings.Contains(base, "/") || strings.Contains(base, "\\") || strings.Contains(base, "..") {
		return nil, fmt.Errorf("invalid backup filename")
	}
	return os.Open(BackupDir + "/" + base)
}

// RemoveUpgradeStaging removes a validated agent upgrade staging binary.
func RemoveUpgradeStaging(path string) error {
	clean, err := UpgradeStagingPath(path)
	if err != nil {
		return err
	}
	if err := os.Remove(clean); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove staging binary: %w", err)
	}
	return nil
}

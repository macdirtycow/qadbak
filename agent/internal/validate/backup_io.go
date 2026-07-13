package validate

import (
	"fmt"
	"os"
)

// OpenBackupFile opens a validated Hestia backup tarball under BackupDir.
func OpenBackupFile(name string) (*os.File, error) {
	base, err := NormalizeBackupFilename(name)
	if err != nil {
		return nil, err
	}
	path, err := BackupAbsPath(base)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	return f, nil
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

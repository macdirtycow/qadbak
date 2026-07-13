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
	if strings.Contains(base, "/") || strings.Contains(base, "\\") || strings.Contains(base, "..") {
		return nil, fmt.Errorf("invalid backup filename")
	}
	fsys := os.DirFS(BackupDir)
	file, err := fsys.Open(base)
	if err != nil {
		return nil, err
	}
	f, ok := file.(*os.File)
	if !ok {
		_ = file.Close()
		return nil, fmt.Errorf("backup file open failed")
	}
	return f, nil
}

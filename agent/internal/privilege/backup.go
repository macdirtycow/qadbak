package privilege

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func privBackupCat(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("backup-cat requires filename")
	}
	name := filepath.Base(strings.TrimSpace(args[0]))
	if !validate.BackupFilename(name) {
		return fmt.Errorf("invalid backup filename")
	}
	path, err := validate.BackupAbsPath(name)
	if err != nil {
		return err
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(os.Stdout, f)
	return err
}

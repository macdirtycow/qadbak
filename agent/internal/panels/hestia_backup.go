package panels

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

// StreamBackupFile streams a Hestia backup tarball to w.
func StreamBackupFile(w http.ResponseWriter, backupPath string) error {
	filename := filepath.Base(backupPath)
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(filename, `"`, "")))
	w.Header().Set("Cache-Control", "no-store")

	if os.Geteuid() == 0 {
		f, err := os.Open(backupPath)
		if err != nil {
			return err
		}
		defer f.Close()
		if stat, err := f.Stat(); err == nil && stat.Size() > 0 {
			w.Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
		}
		_, err = io.Copy(w, f)
		return err
	}

	cmd := exec.Command("sudo", "-n", privilege.BinaryPath(), "priv", "backup-cat", filename)
	cmd.Stdout = w
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("backup download: %w", err)
	}
	return nil
}

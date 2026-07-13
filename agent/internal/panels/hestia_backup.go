package panels

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

// StreamBackupFile streams a Hestia backup tarball to w.
func StreamBackupFile(w http.ResponseWriter, backupName string) error {
	base, err := validate.NormalizeBackupFilename(backupName)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(base, `"`, "")))
	w.Header().Set("Cache-Control", "no-store")
	return privilege.RunStream([]string{"backup-cat", base}, w)
}

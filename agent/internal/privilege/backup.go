package privilege

import (
	"fmt"
	"io"
	"os"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func privBackupCat(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("backup-cat requires filename")
	}
	f, err := validate.OpenBackupFile(args[0])
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(os.Stdout, f)
	return err
}

package system

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func ControlService(unit, action string) error {
	unit = strings.TrimSpace(unit)
	if !validate.ServiceUnit(unit) {
		return fmt.Errorf("invalid service unit")
	}
	switch action {
	case "start", "stop", "restart":
	default:
		return fmt.Errorf("invalid service action")
	}
	cmd := exec.Command("systemctl", action, unit)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

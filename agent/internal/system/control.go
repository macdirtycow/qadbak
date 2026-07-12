package system

import (
	"fmt"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
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
	return privilege.RunSimple([]string{"systemctl", action, unit})
}

package privilege

import (
	"fmt"
	"os"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

// Dispatch handles `qadbak-agent priv …` (must run as root via sudo).
func Dispatch(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("missing priv action")
	}
	switch args[0] {
	case "systemctl":
		return privSystemctl(args[1:])
	case "docker":
		return privDocker(args[1:])
	case "apt-update":
		return privAptUpdate()
	case "apt-upgrade":
		return privAptUpgrade()
	case "reboot":
		return RunSimple([]string{"systemctl", "reboot"})
	case "shutdown":
		return RunSimple([]string{"systemctl", "poweroff"})
	default:
		return fmt.Errorf("unknown priv action")
	}
}

func privSystemctl(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("invalid systemctl invocation")
	}
	action, unit := args[0], args[1]
	switch action {
	case "start", "stop", "restart":
	default:
		return fmt.Errorf("invalid systemctl action")
	}
	if !validate.ServiceUnit(unit) {
		return fmt.Errorf("invalid service unit")
	}
	return RunSimple([]string{"systemctl", action, unit})
}

func privDocker(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("invalid docker invocation")
	}
	action, id := args[0], strings.ToLower(strings.TrimSpace(args[1]))
	switch action {
	case "start", "stop", "restart":
	default:
		return fmt.Errorf("invalid docker action")
	}
	if !validate.ContainerID(id) {
		return fmt.Errorf("invalid container id")
	}
	return RunSimple([]string{"docker", action, id})
}

func privAptUpdate() error {
	return RunSimple([]string{"apt-get", "update", "-qq"})
}

func privAptUpgrade() error {
	return RunSimple([]string{
		"env", "DEBIAN_FRONTEND=noninteractive",
		"apt-get", "upgrade", "-y",
		"-o", "Dpkg::Options::=--force-confdef",
		"-o", "Dpkg::Options::=--force-confold",
	})
}

// MainExit runs priv dispatch and exits the process (for sudo entrypoint).
func MainExit(args []string) {
	if err := Dispatch(args); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}

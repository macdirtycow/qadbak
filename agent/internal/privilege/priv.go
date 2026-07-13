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
		_, err := execRootArgv([]string{"systemctl", "reboot"})
		return err
	case "shutdown":
		_, err := execRootArgv([]string{"systemctl", "poweroff"})
		return err
	case "hestia-cmd":
		return privHestiaCmd(args[1:])
	case "agent-upgrade":
		return privAgentUpgrade(args[1:])
	case "log-tail":
		return privLogTail(args[1:])
	case "domain-fs":
		return privDomainFS(args[1:])
	default:
		return fmt.Errorf("unknown priv action")
	}
}

func privHestiaCmd(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("missing hestia action")
	}
	const hestiaBin = "/usr/local/hestia/bin"
	switch args[0] {
	case "add-api-ip":
		ip := "127.0.0.1"
		if len(args) > 1 {
			ip = strings.TrimSpace(args[1])
		}
		if ip != "127.0.0.1" && ip != "::1" {
			return fmt.Errorf("invalid hestia api ip")
		}
		_, err := Run([]string{hestiaBin + "/v-add-sys-api-ip", ip})
		if err != nil {
			msg := strings.ToLower(err.Error())
			if strings.Contains(msg, "exists") || strings.Contains(msg, "already") {
				return nil
			}
			return err
		}
		return nil
	case "access-key":
		comment := "qadbak-mobile"
		if len(args) > 1 {
			comment = strings.TrimSpace(args[1])
		}
		if comment == "" || strings.ContainsAny(comment, "'\"\\") {
			return fmt.Errorf("invalid hestia access key comment")
		}
		_, err := Run([]string{hestiaBin + "/v-add-access-key", "admin", "*", comment, "json"})
		return err
	default:
		return fmt.Errorf("unknown hestia action")
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
	_, err := execRootArgv([]string{"systemctl", action, unit})
	return err
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
	_, err := execRootArgv([]string{"docker", action, id})
	return err
}

func privAptUpdate() error {
	_, err := execRootArgv([]string{"apt-get", "update", "-qq"})
	return err
}

func privAptUpgrade() error {
	_, err := execRootArgv([]string{
		"env", "DEBIAN_FRONTEND=noninteractive",
		"apt-get", "upgrade", "-y",
		"-o", "Dpkg::Options::=--force-confdef",
		"-o", "Dpkg::Options::=--force-confold",
	})
	return err
}

// MainExit runs priv dispatch and exits the process (for sudo entrypoint).
func MainExit(args []string) {
	if len(args) > 0 && args[0] == "--args-stdin" {
		decoded, err := readPrivArgvStdin()
		if err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
		args = decoded
	}
	if err := Dispatch(args); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}

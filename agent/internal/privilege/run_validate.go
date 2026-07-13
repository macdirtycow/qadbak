package privilege

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

var allowedRootBinaries = map[string]bool{
	"systemctl":        true,
	"docker":           true,
	"apt-get":          true,
	"env":              true,
	"/usr/bin/tail":    true,
	"/usr/bin/install": true,
	"/usr/bin/chown":   true,
	"/usr/bin/chmod":   true,
	"/usr/bin/ln":      true,
}

var allowedPrivActions = map[string]bool{
	"systemctl":     true,
	"docker":        true,
	"apt-update":    true,
	"apt-upgrade":   true,
	"reboot":        true,
	"shutdown":      true,
	"hestia-cmd":    true,
	"agent-upgrade": true,
	"log-tail":      true,
	"domain-fs":     true,
}

func validatePrivArgv(argv []string) error {
	if len(argv) == 0 {
		return fmt.Errorf("empty priv argv")
	}
	action := strings.TrimSpace(argv[0])
	if !allowedPrivActions[action] {
		return fmt.Errorf("priv action not allowed")
	}
	switch action {
	case "systemctl":
		if len(argv) != 3 {
			return fmt.Errorf("invalid systemctl argv")
		}
		switch argv[1] {
		case "start", "stop", "restart":
		default:
			return fmt.Errorf("invalid systemctl action")
		}
		if !validate.ServiceUnit(argv[2]) {
			return fmt.Errorf("invalid service unit")
		}
	case "docker":
		if len(argv) != 3 {
			return fmt.Errorf("invalid docker argv")
		}
		switch argv[1] {
		case "start", "stop", "restart":
		default:
			return fmt.Errorf("invalid docker action")
		}
		if !validate.ContainerID(strings.ToLower(argv[2])) {
			return fmt.Errorf("invalid container id")
		}
	case "apt-update", "apt-upgrade", "reboot", "shutdown":
		if len(argv) != 1 {
			return fmt.Errorf("invalid priv argv")
		}
	case "hestia-cmd":
		if len(argv) < 2 {
			return fmt.Errorf("invalid hestia argv")
		}
		switch argv[1] {
		case "add-api-ip":
			ip := "127.0.0.1"
			if len(argv) > 2 {
				ip = strings.TrimSpace(argv[2])
			}
			if ip != "127.0.0.1" && ip != "::1" {
				return fmt.Errorf("invalid hestia api ip")
			}
		case "access-key":
			comment := "qadbak-mobile"
			if len(argv) > 2 {
				comment = strings.TrimSpace(argv[2])
			}
			if comment == "" || strings.ContainsAny(comment, "'\"\\") {
				return fmt.Errorf("invalid hestia access key comment")
			}
		default:
			return fmt.Errorf("unknown hestia action")
		}
	case "agent-upgrade":
		if len(argv) != 2 {
			return fmt.Errorf("invalid agent-upgrade argv")
		}
		if _, err := validateUpgradeStagingPath(argv[1]); err != nil {
			return err
		}
	case "log-tail":
		if len(argv) != 3 {
			return fmt.Errorf("invalid log-tail argv")
		}
		if _, err := validateLogPath(argv[1]); err != nil {
			return err
		}
	case "domain-fs":
		if len(argv) < 3 {
			return fmt.Errorf("invalid domain-fs argv")
		}
		if err := validateDomainFSArgv(argv[1], argv[2:]); err != nil {
			return err
		}
	}
	return nil
}

func validateRootArgv(argv []string) error {
	if len(argv) == 0 {
		return fmt.Errorf("empty argv")
	}
	bin := argv[0]
	if !allowedRootBinaries[bin] {
		return fmt.Errorf("root command not allowed")
	}
	switch bin {
	case "systemctl":
		if len(argv) != 3 {
			return fmt.Errorf("invalid systemctl argv")
		}
		switch argv[2] {
		case "reboot", "poweroff":
			return nil
		}
		switch argv[1] {
		case "start", "stop", "restart", "daemon-reload":
		default:
			return fmt.Errorf("invalid systemctl action")
		}
		if argv[2] != "qadbak-agent.service" && !validate.ServiceUnit(argv[2]) {
			return fmt.Errorf("invalid service unit")
		}
	case "docker":
		if len(argv) != 3 {
			return fmt.Errorf("invalid docker argv")
		}
		switch argv[1] {
		case "start", "stop", "restart":
		default:
			return fmt.Errorf("invalid docker action")
		}
		if !validate.ContainerID(strings.ToLower(argv[2])) {
			return fmt.Errorf("invalid container id")
		}
	case "/usr/bin/tail":
		if len(argv) != 4 || argv[1] != "-n" {
			return fmt.Errorf("invalid tail argv")
		}
		if _, err := validateLogPath(argv[3]); err != nil {
			return err
		}
	}
	return nil
}

func validateDomainFSArgv(cmd string, args []string) error {
	switch cmd {
	case "list", "read", "mkdir", "delete":
		if len(args) != 1 {
			return fmt.Errorf("invalid domain-fs argv")
		}
		if _, err := assertHomePath(args[0]); err != nil {
			return err
		}
	case "write":
		if len(args) != 2 {
			return fmt.Errorf("invalid domain-fs write argv")
		}
		if _, err := assertHomePath(args[0]); err != nil {
			return err
		}
	case "move":
		if len(args) != 2 {
			return fmt.Errorf("invalid domain-fs move argv")
		}
		if _, err := assertHomePath(args[0]); err != nil {
			return err
		}
		if _, err := assertHomePath(args[1]); err != nil {
			return err
		}
	case "upload":
		if len(args) != 3 {
			return fmt.Errorf("invalid domain-fs upload argv")
		}
		if _, err := assertHomePath(args[0]); err != nil {
			return err
		}
		if safeBaseName(args[1]) == "" {
			return fmt.Errorf("invalid upload filename")
		}
	default:
		return fmt.Errorf("unknown domain-fs command")
	}
	return nil
}

func execRootArgv(argv []string) ([]byte, error) {
	if err := validateRootArgv(argv); err != nil {
		return nil, err
	}
	var out []byte
	var err error
	switch argv[0] {
	case "systemctl":
		out, err = exec.Command("systemctl", argv[1], argv[2]).CombinedOutput()
	case "docker":
		out, err = exec.Command("docker", argv[1], argv[2]).CombinedOutput()
	case "apt-get":
		out, err = exec.Command("apt-get", argv[1], argv[2]).CombinedOutput()
	case "env":
		out, err = exec.Command("env", argv[1], argv[2], argv[3], argv[4], argv[5], argv[6]).CombinedOutput()
	case "/usr/bin/tail":
		out, err = exec.Command("/usr/bin/tail", "-n", argv[2], argv[3]).CombinedOutput()
	case "/usr/bin/install":
		out, err = exec.Command("/usr/bin/install", argv[1], argv[2], argv[3], argv[4], argv[5]).CombinedOutput()
	case "/usr/bin/chown":
		out, err = exec.Command("/usr/bin/chown", argv[1], argv[2]).CombinedOutput()
	case "/usr/bin/chmod":
		out, err = exec.Command("/usr/bin/chmod", argv[1], argv[2]).CombinedOutput()
	case "/usr/bin/ln":
		out, err = exec.Command("/usr/bin/ln", argv[1], argv[2], argv[3]).CombinedOutput()
	default:
		return nil, fmt.Errorf("root command not allowed")
	}
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return out, fmt.Errorf("%s", msg)
	}
	return out, nil
}

func execSudoPriv(argv []string) ([]byte, error) {
	if err := validatePrivArgv(argv); err != nil {
		return nil, err
	}
	bin := BinaryPath()
	if !strings.HasPrefix(bin, "/") {
		return nil, fmt.Errorf("invalid agent binary path")
	}
	var out []byte
	var err error
	switch argv[0] {
	case "systemctl":
		out, err = exec.Command("sudo", "-n", bin, "priv", "systemctl", argv[1], argv[2]).CombinedOutput()
	case "docker":
		out, err = exec.Command("sudo", "-n", bin, "priv", "docker", argv[1], argv[2]).CombinedOutput()
	case "apt-update":
		out, err = exec.Command("sudo", "-n", bin, "priv", "apt-update").CombinedOutput()
	case "apt-upgrade":
		out, err = exec.Command("sudo", "-n", bin, "priv", "apt-upgrade").CombinedOutput()
	case "reboot":
		out, err = exec.Command("sudo", "-n", bin, "priv", "reboot").CombinedOutput()
	case "shutdown":
		out, err = exec.Command("sudo", "-n", bin, "priv", "shutdown").CombinedOutput()
	case "hestia-cmd":
		out, err = execHestiaPriv(bin, argv)
	case "agent-upgrade":
		out, err = exec.Command("sudo", "-n", bin, "priv", "agent-upgrade", argv[1]).CombinedOutput()
	case "log-tail":
		out, err = exec.Command("sudo", "-n", bin, "priv", "log-tail", argv[1], argv[2]).CombinedOutput()
	case "domain-fs":
		out, err = execDomainFSPriv(bin, argv)
	default:
		return nil, fmt.Errorf("priv action not allowed")
	}
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return out, fmt.Errorf("%s", msg)
	}
	return out, nil
}

func execHestiaPriv(bin string, argv []string) ([]byte, error) {
	switch argv[1] {
	case "add-api-ip":
		ip := "127.0.0.1"
		if len(argv) > 2 {
			ip = argv[2]
		}
		return exec.Command("sudo", "-n", bin, "priv", "hestia-cmd", "add-api-ip", ip).CombinedOutput()
	case "access-key":
		comment := "qadbak-mobile"
		if len(argv) > 2 {
			comment = argv[2]
		}
		return exec.Command("sudo", "-n", bin, "priv", "hestia-cmd", "access-key", comment).CombinedOutput()
	default:
		return nil, fmt.Errorf("unknown hestia action")
	}
}

func execDomainFSPriv(bin string, argv []string) ([]byte, error) {
	switch argv[1] {
	case "list", "read", "mkdir", "delete":
		return exec.Command("sudo", "-n", bin, "priv", "domain-fs", argv[1], argv[2]).CombinedOutput()
	case "write":
		return exec.Command("sudo", "-n", bin, "priv", "domain-fs", "write", argv[2], argv[3]).CombinedOutput()
	case "move":
		return exec.Command("sudo", "-n", bin, "priv", "domain-fs", "move", argv[2], argv[3]).CombinedOutput()
	case "upload":
		return exec.Command("sudo", "-n", bin, "priv", "domain-fs", "upload", argv[2], argv[3], argv[4]).CombinedOutput()
	default:
		return nil, fmt.Errorf("unknown domain-fs command")
	}
}

func isPrivAction(action string) bool {
	return allowedPrivActions[strings.TrimSpace(action)]
}

func runPrivInProcess(argv []string) ([]byte, error) {
	if err := validatePrivArgv(argv); err != nil {
		return nil, err
	}
	r, w, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	old := os.Stdout
	os.Stdout = w
	dispatchErr := Dispatch(argv)
	w.Close()
	os.Stdout = old
	out, _ := io.ReadAll(r)
	r.Close()
	if dispatchErr != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = dispatchErr.Error()
		}
		return out, fmt.Errorf("%s", msg)
	}
	return out, nil
}

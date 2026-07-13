package privilege

import (
	"bytes"
	"encoding/json"
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
	"backup-cat":    true,
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
		if _, err := validate.UpgradeStagingPath(argv[1]); err != nil {
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
	case "backup-cat":
		if len(argv) != 2 {
			return fmt.Errorf("invalid backup-cat argv")
		}
		if !validate.BackupFilename(argv[1]) {
			return fmt.Errorf("invalid backup filename")
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
	bin := BinaryPath()
	if !strings.HasPrefix(bin, "/") {
		return nil, fmt.Errorf("invalid agent binary path")
	}
	payload, err := json.Marshal(argv)
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(bin, "priv", "--root-exec-stdin")
	cmd.Stdin = bytes.NewReader(payload)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return out, fmt.Errorf("%s", msg)
	}
	return out, nil
}

func readRootArgvStdin() ([]string, error) {
	raw, err := io.ReadAll(io.LimitReader(os.Stdin, 1<<20))
	if err != nil {
		return nil, err
	}
	var argv []string
	if err := json.Unmarshal(raw, &argv); err != nil {
		return nil, fmt.Errorf("invalid root exec stdin payload")
	}
	if err := validateRootArgv(argv); err != nil {
		return nil, err
	}
	return argv, nil
}

func runRootExec(argv []string) ([]byte, error) {
	if err := validateRootArgv(argv); err != nil {
		return nil, err
	}
	cmd := exec.Command(argv[0], argv[1:]...)
	return cmd.CombinedOutput()
}

func execSudoPriv(argv []string) ([]byte, error) {
	if err := validatePrivArgv(argv); err != nil {
		return nil, err
	}
	bin := BinaryPath()
	if !strings.HasPrefix(bin, "/") {
		return nil, fmt.Errorf("invalid agent binary path")
	}
	payload, err := json.Marshal(argv)
	if err != nil {
		return nil, err
	}
	cmd := exec.Command("sudo", "-n", bin, "priv", "--args-stdin")
	cmd.Stdin = bytes.NewReader(payload)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return out, fmt.Errorf("%s", msg)
	}
	return out, nil
}

func readPrivArgvStdin() ([]string, error) {
	raw, err := io.ReadAll(io.LimitReader(os.Stdin, 1<<20))
	if err != nil {
		return nil, err
	}
	var argv []string
	if err := json.Unmarshal(raw, &argv); err != nil {
		return nil, fmt.Errorf("invalid priv stdin payload")
	}
	if err := validatePrivArgv(argv); err != nil {
		return nil, err
	}
	return argv, nil
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

func runPrivInProcessStream(argv []string, w io.Writer) error {
	if err := validatePrivArgv(argv); err != nil {
		return err
	}
	r, wPipe, err := os.Pipe()
	if err != nil {
		return err
	}
	old := os.Stdout
	os.Stdout = wPipe
	dispatchErr := Dispatch(argv)
	wPipe.Close()
	os.Stdout = old
	_, copyErr := io.Copy(w, r)
	r.Close()
	if dispatchErr != nil {
		return dispatchErr
	}
	return copyErr
}

func execSudoPrivStream(argv []string, w io.Writer) error {
	if err := validatePrivArgv(argv); err != nil {
		return err
	}
	bin := BinaryPath()
	if !strings.HasPrefix(bin, "/") {
		return fmt.Errorf("invalid agent binary path")
	}
	payload, err := json.Marshal(argv)
	if err != nil {
		return err
	}
	cmd := exec.Command("sudo", "-n", bin, "priv", "--args-stdin")
	cmd.Stdin = bytes.NewReader(payload)
	cmd.Stdout = w
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

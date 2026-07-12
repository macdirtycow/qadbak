package privilege

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const defaultBinary = "/usr/lib/qadbak-agent/qadbak-agent"

// BinaryPath returns the agent binary used for sudo priv delegation.
func BinaryPath() string {
	if p := strings.TrimSpace(os.Getenv("QADBAK_AGENT_BINARY")); p != "" {
		return p
	}
	if _, err := os.Stat(defaultBinary); err == nil {
		return defaultBinary
	}
	if exe, err := os.Executable(); err == nil {
		return exe
	}
	return defaultBinary
}

// Run executes argv[0] with remaining args, delegating to `qadbak-agent priv` when not root.
func Run(argv []string) ([]byte, error) {
	if len(argv) == 0 {
		return nil, fmt.Errorf("empty command")
	}
	var cmd *exec.Cmd
	if os.Geteuid() == 0 {
		cmd = exec.Command(argv[0], argv[1:]...)
	} else {
		bin := BinaryPath()
		cmd = exec.Command("sudo", append([]string{"-n", bin, "priv"}, argv...)...)
	}
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

// RunSimple is Run without caring about stdout.
func RunSimple(argv []string) error {
	_, err := Run(argv)
	return err
}

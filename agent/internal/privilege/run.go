package privilege

import (
	"fmt"
	"io"
	"os"
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
	if os.Geteuid() == 0 {
		if isPrivAction(argv[0]) {
			return runPrivInProcess(argv)
		}
		return execRootArgv(argv)
	}
	return execSudoPriv(argv)
}

// RunSimple is Run without caring about stdout.
func RunSimple(argv []string) error {
	_, err := Run(argv)
	return err
}

// RunStream executes a validated priv action and streams stdout to w.
func RunStream(argv []string, w io.Writer) error {
	if len(argv) == 0 {
		return fmt.Errorf("empty command")
	}
	if os.Geteuid() == 0 {
		if isPrivAction(argv[0]) {
			return runPrivInProcessStream(argv, w)
		}
		return fmt.Errorf("unsupported stream command")
	}
	return execSudoPrivStream(argv, w)
}

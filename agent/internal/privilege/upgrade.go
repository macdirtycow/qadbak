package privilege

import (
	"fmt"
	"path/filepath"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

const (
	agentInstallDir = "/usr/lib/qadbak-agent"
	agentUnixUser   = "qadbak-agent"
)

func privAgentUpgrade(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("invalid agent-upgrade invocation")
	}
	binSrc, err := validate.UpgradeStagingBinary(args[0])
	if err != nil {
		return err
	}
	_ = RunSimple([]string{"systemctl", "stop", "qadbak-agent.service"})
	if err := RunSimple([]string{"/usr/bin/install", "-d", "-m", "0750", agentInstallDir}); err != nil {
		return err
	}
	_ = RunSimple([]string{"/usr/bin/chown", "root:" + agentUnixUser, agentInstallDir})
	_ = RunSimple([]string{"/usr/bin/chmod", "0750", agentInstallDir})
	dest := filepath.Join(agentInstallDir, "qadbak-agent")
	if err := RunSimple([]string{
		"/usr/bin/install", "-m", "0750", "-o", "root", "-g", agentUnixUser, binSrc, dest,
	}); err != nil {
		return err
	}
	_ = RunSimple([]string{"/usr/bin/ln", "-sf", dest, "/usr/local/bin/qadbak-agent"})
	_ = RunSimple([]string{"systemctl", "daemon-reload"})
	if err := RunSimple([]string{"systemctl", "start", "qadbak-agent.service"}); err != nil {
		return err
	}
	return validate.RemoveUpgradeStaging(args[0])
}

package privilege

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	agentInstallDir = "/usr/lib/qadbak-agent"
	agentUnixUser   = "qadbak-agent"
	stagingBaseName = "qadbak-agent-staging"
)

func privAgentUpgrade(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("invalid agent-upgrade invocation")
	}
	binSrc, err := validateUpgradeStagingPath(args[0])
	if err != nil {
		return err
	}
	info, err := os.Stat(binSrc)
	if err != nil {
		return fmt.Errorf("staging binary missing")
	}
	if info.Size() < 1024 {
		return fmt.Errorf("staging binary too small")
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
	_ = os.Remove(binSrc)
	return nil
}

func validateUpgradeStagingPath(path string) (string, error) {
	clean := filepath.Clean(strings.TrimSpace(path))
	if clean == "" || !filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid upgrade path")
	}
	if filepath.Base(clean) != stagingBaseName {
		return "", fmt.Errorf("invalid upgrade filename")
	}
	if !strings.Contains(clean, string(os.PathSeparator)+"upgrade"+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid upgrade directory")
	}
	return clean, nil
}

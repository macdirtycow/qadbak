package system

import (
	"bufio"
	"bytes"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

type UpdatesInfo struct {
	AvailableCount int      `json:"availableCount"`
	Packages       []string `json:"packages"`
	LastChecked    string   `json:"lastChecked,omitempty"`
	RebootRequired bool     `json:"rebootRequired,omitempty"`
}

func CheckUpdates() (UpdatesInfo, error) {
	_ = privilege.RunSimple([]string{"apt-update"})

	out, err := exec.Command("apt-get", "-s", "upgrade").Output()
	if err != nil {
		return UpdatesInfo{}, err
	}

	packages := parseUpgradePackages(out)
	info := UpdatesInfo{
		AvailableCount: len(packages),
		Packages:       packages,
		LastChecked:    time.Now().UTC().Format(time.RFC3339),
		RebootRequired: rebootRequired(),
	}
	return info, nil
}

func InstallUpdates() error {
	if err := privilege.RunSimple([]string{"apt-update"}); err != nil {
		return err
	}
	return privilege.RunSimple([]string{"apt-upgrade"})
}

func Reboot() error {
	return privilege.RunSimple([]string{"reboot"})
}

func Shutdown() error {
	return privilege.RunSimple([]string{"shutdown"})
}

func parseUpgradePackages(out []byte) []string {
	sc := bufio.NewScanner(bytes.NewReader(out))
	packages := make([]string, 0, 32)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "Inst ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			name := strings.TrimSuffix(fields[1], ";")
			if name != "" {
				packages = append(packages, name)
			}
		}
		if len(packages) >= 100 {
			break
		}
	}
	return packages
}

func rebootRequired() bool {
	_, err := os.Stat("/var/run/reboot-required")
	return err == nil
}

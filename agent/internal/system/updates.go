package system

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type UpdatesInfo struct {
	AvailableCount int      `json:"availableCount"`
	Packages       []string `json:"packages"`
	LastChecked    string   `json:"lastChecked,omitempty"`
	RebootRequired bool     `json:"rebootRequired,omitempty"`
}

func CheckUpdates() (UpdatesInfo, error) {
	_ = exec.Command("apt-get", "update", "-qq").Run()

	cmd := exec.Command("apt-get", "-s", "upgrade")
	out, err := cmd.Output()
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
	update := exec.Command("apt-get", "update", "-qq")
	if out, err := update.CombinedOutput(); err != nil {
		return fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	upgrade := exec.Command(
		"env", "DEBIAN_FRONTEND=noninteractive",
		"apt-get", "upgrade", "-y", "-o", "Dpkg::Options::=--force-confdef", "-o", "Dpkg::Options::=--force-confold",
	)
	out, err := upgrade.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

func Reboot() error {
	return exec.Command("systemctl", "reboot").Run()
}

func Shutdown() error {
	return exec.Command("systemctl", "poweroff").Run()
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

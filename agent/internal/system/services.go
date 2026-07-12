package system

import (
	"bufio"
	"bytes"
	"os/exec"
	"strings"
)

type ServiceUnit struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	Description string `json:"description"`
	CanManage   bool   `json:"canManage"`
}

func ListServices(limit int) ([]ServiceUnit, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	cmd := exec.Command(
		"systemctl",
		"list-units",
		"--type=service",
		"--state=running,failed,exited",
		"--no-pager",
		"--no-legend",
		"--plain",
	)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseServiceList(out, limit), nil
}

// ParseServiceListForTest exposes parsing for unit tests.
func ParseServiceListForTest(out []byte, limit int) []ServiceUnit {
	return parseServiceList(out, limit)
}

func parseServiceList(out []byte, limit int) []ServiceUnit {
	sc := bufio.NewScanner(bytes.NewReader(out))
	services := make([]ServiceUnit, 0, limit)
	for sc.Scan() {
		if len(services) >= limit {
			break
		}
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		unit := fields[0]
		if !strings.HasSuffix(unit, ".service") {
			continue
		}
		active := fields[2]
		desc := strings.Join(fields[4:], " ")
		services = append(services, ServiceUnit{
			ID:          unit,
			Name:        unit,
			Status:      active,
			Description: desc,
			CanManage:   true,
		})
	}
	return services
}

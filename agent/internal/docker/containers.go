package docker

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

type Container struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Image        string  `json:"image"`
	Status       string  `json:"status"`
	CPUPercent   float64 `json:"cpuPercent,omitempty"`
	MemoryBytes  int64   `json:"memoryBytes,omitempty"`
}

func Available() bool {
	if _, err := exec.LookPath("docker"); err != nil {
		return false
	}
	cmd := exec.Command("docker", "info", "--format", "{{.ServerVersion}}")
	return cmd.Run() == nil
}

func ListContainers(limit int) ([]Container, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	cmd := exec.Command(
		"docker", "ps", "-a",
		"--no-trunc",
		"--format", "{{json .}}",
	)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseContainerList(out, limit), nil
}

type dockerRow struct {
	ID     string `json:"ID"`
	Names  string `json:"Names"`
	Image  string `json:"Image"`
	Status string `json:"Status"`
}

func parseContainerList(out []byte, limit int) []Container {
	sc := bufio.NewScanner(bytes.NewReader(out))
	containers := make([]Container, 0, limit)
	for sc.Scan() {
		if len(containers) >= limit {
			break
		}
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var row dockerRow
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			continue
		}
		id := strings.TrimSpace(row.ID)
		if id == "" {
			continue
		}
		if len(id) > 12 {
			id = id[:12]
		}
		name := strings.TrimPrefix(strings.TrimSpace(row.Names), "/")
		containers = append(containers, Container{
			ID:     id,
			Name:   name,
			Image:  strings.TrimSpace(row.Image),
			Status: strings.TrimSpace(row.Status),
		})
	}
	return containers
}

func ControlContainer(id, action string) error {
	id = strings.TrimSpace(strings.ToLower(id))
	if !validate.ContainerID(id) {
		return fmt.Errorf("invalid container id")
	}
	switch action {
	case "start", "stop", "restart":
	default:
		return fmt.Errorf("invalid container action")
	}
	return privilege.RunSimple([]string{"docker", action, id})
}

package docker

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"strconv"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/util"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func ContainerLogs(id string, tail int) ([]string, error) {
	id = strings.TrimSpace(strings.ToLower(id))
	if !validate.ContainerID(id) {
		return nil, fmt.Errorf("invalid container id")
	}
	if tail <= 0 || tail > 500 {
		tail = 200
	}
	cmd := exec.Command("docker", "logs", "--timestamps", "--tail", strconv.Itoa(tail), id)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("%s", msg)
	}
	return sanitizeLogLines(out), nil
}

func sanitizeLogLines(out []byte) []string {
	sc := bufio.NewScanner(bytes.NewReader(out))
	lines := make([]string, 0, 128)
	for sc.Scan() {
		line := util.SanitizeLogLine(sc.Text())
		if line == "" {
			continue
		}
		lines = append(lines, line)
		if len(lines) >= 500 {
			break
		}
	}
	return lines
}

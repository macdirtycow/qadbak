package logs

import (
	"bufio"
	"bytes"
	"os/exec"
	"strconv"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/util"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

type Page struct {
	Lines      []string `json:"lines"`
	NextCursor string   `json:"nextCursor,omitempty"`
}

func Fetch(source, filter, cursor string, tail int, before bool) (Page, error) {
	if !validate.LogSource(source) {
		return Page{}, errInvalidSource
	}
	if tail <= 0 || tail > 500 {
		tail = 200
	}

	args := []string{
		"--no-pager",
		"--output=short-iso",
		"--show-cursor",
	}
	source = strings.TrimSpace(source)
	if source == "" {
		source = "journal"
	}
	switch source {
	case "service":
		filter = strings.TrimSpace(filter)
		if filter == "" {
			return Page{}, errFilterRequired
		}
		if !validate.ServiceUnit(filter) && !strings.HasSuffix(filter, ".service") {
			filter += ".service"
		}
		if !validate.ServiceUnit(filter) {
			return Page{}, errInvalidFilter
		}
		args = append(args, "-u", filter)
	case "journal":
	default:
		return Page{}, errInvalidSource
	}
	if c := strings.TrimSpace(cursor); c != "" {
		if before {
			args = append(args, "--before-cursor="+c)
		} else {
			args = append(args, "--cursor="+c)
		}
	}
	args = append(args, "-n", strconv.Itoa(tail))

	cmd := exec.Command("journalctl", args...)
	out, err := cmd.Output()
	if err != nil {
		return Page{}, err
	}
	return parseJournalOutput(out), nil
}

func parseJournalOutput(out []byte) Page {
	sc := bufio.NewScanner(bytes.NewReader(out))
	lines := make([]string, 0, 64)
	nextCursor := ""
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "-- cursor:") {
			nextCursor = strings.TrimSpace(strings.TrimPrefix(line, "-- cursor:"))
			continue
		}
		if strings.HasPrefix(line, "-- No entries --") {
			continue
		}
		lines = append(lines, util.SanitizeLogLine(line))
	}
	if nextCursor == "" && len(lines) > 0 {
		nextCursor = ""
	}
	return Page{Lines: lines, NextCursor: nextCursor}
}

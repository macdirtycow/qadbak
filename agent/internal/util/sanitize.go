package util

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

var ansiEscape = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

const maxLogLineLen = 4096

func SanitizeLogLine(line string) string {
	line = ansiEscape.ReplaceAllString(line, "")
	line = strings.TrimRight(line, "\r\n")
	if len(line) > maxLogLineLen {
		line = line[:maxLogLineLen] + "…"
	}
	if !utf8.ValidString(line) {
		line = strings.ToValidUTF8(line, "�")
	}
	return line
}

func SanitizeLogLines(lines []string) []string {
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		out = append(out, SanitizeLogLine(line))
	}
	return out
}

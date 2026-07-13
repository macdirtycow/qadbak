package privilege

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

var hestiaConfPath = "/usr/local/hestia/conf/hestia.conf"

var hestiaUsernameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$`)

func parseHestiaRootUser(data []byte) (string, error) {
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "ROOT_USER=") {
			continue
		}
		user := strings.TrimSpace(strings.TrimPrefix(line, "ROOT_USER="))
		user = strings.Trim(user, `"'`)
		if user == "" || !hestiaUsernameRe.MatchString(user) {
			return "", fmt.Errorf("invalid hestia ROOT_USER")
		}
		return user, nil
	}
	return "", fmt.Errorf("hestia ROOT_USER not found")
}

func hestiaRootUser() (string, error) {
	data, err := os.ReadFile(hestiaConfPath)
	if err != nil {
		return "", fmt.Errorf("read hestia config: %w", err)
	}
	return parseHestiaRootUser(data)
}

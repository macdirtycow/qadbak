package panels

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// ValidatePanelBaseURL ensures panel API calls stay on loopback (agent and panel co-located).
func ValidatePanelBaseURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty panel base URL")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid panel base URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("panel base URL must use http or https")
	}
	host := strings.TrimSpace(u.Hostname())
	if host == "" {
		return "", fmt.Errorf("panel base URL host required")
	}
	if !isLoopbackHost(host) {
		return "", fmt.Errorf("panel base URL must target localhost")
	}
	return strings.TrimRight(raw, "/"), nil
}

func isLoopbackHost(host string) bool {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// ResolvePanelBaseURL returns a validated base URL or the package default.
func ResolvePanelBaseURL(raw string, defaultFn func() string) string {
	base := strings.TrimSpace(raw)
	if base == "" {
		return defaultFn()
	}
	validated, err := ValidatePanelBaseURL(base)
	if err != nil {
		return defaultFn()
	}
	return validated
}

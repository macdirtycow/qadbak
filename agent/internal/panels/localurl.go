package panels

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

// ParseLoopbackPanelURL validates and rebuilds a panel base URL from trusted fields only.
func ParseLoopbackPanelURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("empty panel base URL")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid panel base URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("panel base URL must use http or https")
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" || !isLoopbackHost(host) {
		return nil, fmt.Errorf("panel base URL must target localhost")
	}
	port := parsed.Port()
	if port != "" {
		p, err := strconv.Atoi(port)
		if err != nil || p < 1 || p > 65535 {
			return nil, fmt.Errorf("invalid panel base URL port")
		}
	}
	canonicalHost := canonicalLoopbackHost(host)
	out := &url.URL{Scheme: parsed.Scheme}
	if port != "" {
		out.Host = net.JoinHostPort(canonicalHost, port)
	} else {
		out.Host = canonicalHost
	}
	return out, nil
}

// JoinPanelPath joins a fixed API path onto a sanitized loopback panel URL.
func JoinPanelPath(base *url.URL, path string) (string, error) {
	if base == nil {
		return "", fmt.Errorf("missing panel base URL")
	}
	if !strings.HasPrefix(path, "/") || strings.Contains(path, "..") {
		return "", fmt.Errorf("invalid panel API path")
	}
	cloned := *base
	cloned.Path = strings.TrimRight(cloned.Path, "/") + path
	return cloned.String(), nil
}

func canonicalLoopbackHost(host string) string {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1":
		return "127.0.0.1"
	case "::1":
		return "::1"
	default:
		if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
			if ip.To4() == nil {
				return "::1"
			}
			return "127.0.0.1"
		}
		return "127.0.0.1"
	}
}

// ValidatePanelBaseURL ensures panel API calls stay on loopback (agent and panel co-located).
func ValidatePanelBaseURL(raw string) (string, error) {
	u, err := ParseLoopbackPanelURL(raw)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(u.String(), "/"), nil
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
		base = defaultFn()
	}
	u, err := ParseLoopbackPanelURL(base)
	if err != nil {
		u, err = ParseLoopbackPanelURL(defaultFn())
		if err != nil {
			return defaultFn()
		}
	}
	return strings.TrimRight(u.String(), "/")
}

// ResolvePanelBase returns a sanitized loopback URL pointer.
func ResolvePanelBase(raw string, defaultFn func() string) (*url.URL, error) {
	base := strings.TrimSpace(raw)
	if base == "" {
		return ParseLoopbackPanelURL(defaultFn())
	}
	u, err := ParseLoopbackPanelURL(base)
	if err != nil {
		return ParseLoopbackPanelURL(defaultFn())
	}
	return u, nil
}

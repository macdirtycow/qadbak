package panels

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

// LoopbackEndpoint is a sanitized localhost panel target (scheme + port only).
type LoopbackEndpoint struct {
	scheme string
	port   int
}

func (e LoopbackEndpoint) URL(path string) string {
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return fmt.Sprintf("%s://127.0.0.1:%d%s", e.scheme, e.port, path)
}

func defaultHestiaEndpoint() LoopbackEndpoint {
	return LoopbackEndpoint{scheme: "https", port: 8083}
}

func defaultCoolifyEndpoint() LoopbackEndpoint {
	return LoopbackEndpoint{scheme: "http", port: 8000}
}

func defaultCasaOSEndpoint() LoopbackEndpoint {
	return LoopbackEndpoint{scheme: "http", port: 80}
}

// ResolveLoopbackEndpoint parses a stored panel URL and returns trusted localhost fields.
func ResolveLoopbackEndpoint(raw, defaultScheme string, defaultPort int) (LoopbackEndpoint, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		if defaultScheme != "http" && defaultScheme != "https" {
			return LoopbackEndpoint{}, fmt.Errorf("invalid default scheme")
		}
		if defaultPort < 1 || defaultPort > 65535 {
			return LoopbackEndpoint{}, fmt.Errorf("invalid default port")
		}
		return LoopbackEndpoint{scheme: defaultScheme, port: defaultPort}, nil
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return LoopbackEndpoint{}, fmt.Errorf("invalid panel base URL")
	}
	scheme := parsed.Scheme
	if scheme != "http" && scheme != "https" {
		return LoopbackEndpoint{}, fmt.Errorf("panel base URL must use http or https")
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" || !isLoopbackHost(host) {
		return LoopbackEndpoint{}, fmt.Errorf("panel base URL must target localhost")
	}
	port := defaultPort
	if p := parsed.Port(); p != "" {
		port, err = strconv.Atoi(p)
		if err != nil || port < 1 || port > 65535 {
			return LoopbackEndpoint{}, fmt.Errorf("invalid panel base URL port")
		}
	}
	return LoopbackEndpoint{scheme: scheme, port: port}, nil
}

// ParseLoopbackPanelURL validates and rebuilds a panel base URL from trusted fields only.
func ParseLoopbackPanelURL(raw string) (*url.URL, error) {
	ep, err := ResolveLoopbackEndpoint(raw, "http", 80)
	if err != nil {
		return nil, err
	}
	parsed, err := url.Parse(ep.URL("/"))
	if err != nil {
		return nil, err
	}
	return parsed, nil
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
	def := defaultFn()
	parsed, err := url.Parse(def)
	if err != nil {
		return def
	}
	port := 80
	if p := parsed.Port(); p != "" {
		port, _ = strconv.Atoi(p)
	}
	ep, err := ResolveLoopbackEndpoint(raw, parsed.Scheme, port)
	if err != nil {
		ep, err = ResolveLoopbackEndpoint("", parsed.Scheme, port)
		if err != nil {
			return def
		}
	}
	return strings.TrimRight(ep.URL("/"), "/")
}

// ResolvePanelBase returns a sanitized loopback URL pointer.
func ResolvePanelBase(raw string, defaultFn func() string) (*url.URL, error) {
	s := ResolvePanelBaseURL(raw, defaultFn)
	return url.Parse(s)
}

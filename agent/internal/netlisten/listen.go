package netlisten

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
)

// Default returns the HTTPS listen address when neither -listen nor QADBAK_AGENT_LISTEN is set.
// Defaults to loopback only; use installer/onboarding to opt into Tailscale or LAN exposure.
func Default(port int) string {
	if v := strings.TrimSpace(os.Getenv("QADBAK_AGENT_LISTEN")); v != "" {
		return v
	}
	if port <= 0 {
		port = 9443
	}
	return fmt.Sprintf("127.0.0.1:%d", port)
}

// Resolve applies QADBAK_AGENT_LISTEN_MODE when QADBAK_AGENT_LISTEN is empty.
// Modes: tailscale, lan, local (or localhost). Unknown modes fall back to loopback.
func Resolve(port int) string {
	if v := strings.TrimSpace(os.Getenv("QADBAK_AGENT_LISTEN")); v != "" {
		return v
	}
	if port <= 0 {
		port = 9443
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("QADBAK_AGENT_LISTEN_MODE"))) {
	case "lan":
		return fmt.Sprintf("0.0.0.0:%d", port)
	case "tailscale":
		if ip, ok := TailscaleIPv4(); ok {
			return fmt.Sprintf("%s:%d", ip, port)
		}
		return fmt.Sprintf("127.0.0.1:%d", port)
	case "local", "localhost":
		return fmt.Sprintf("127.0.0.1:%d", port)
	default:
		if ip, ok := TailscaleIPv4(); ok {
			return fmt.Sprintf("%s:%d", ip, port)
		}
		return fmt.Sprintf("127.0.0.1:%d", port)
	}
}

// TailscaleIPv4 returns the primary Tailscale IPv4 address when present.
func TailscaleIPv4() (string, bool) {
	if out, err := exec.Command("tailscale", "ip", "-4").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			ip := strings.TrimSpace(line)
			if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() != nil {
				return ip, true
			}
		}
	}
	iface, err := net.InterfaceByName("tailscale0")
	if err != nil {
		return "", false
	}
	addrs, err := iface.Addrs()
	if err != nil {
		return "", false
	}
	for _, addr := range addrs {
		var ip net.IP
		switch v := addr.(type) {
		case *net.IPNet:
			ip = v.IP
		case *net.IPAddr:
			ip = v.IP
		}
		if ip != nil && ip.To4() != nil {
			return ip.String(), true
		}
	}
	return "", false
}

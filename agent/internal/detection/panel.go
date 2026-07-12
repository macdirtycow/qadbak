package detection

import (
	"os"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/docker"
)

type Result struct {
	DetectedPanel string   `json:"detectedPanel"`
	Confidence    string   `json:"confidence"`
	Signals       []string `json:"signals"`
}

func DetectPanel() Result {
	checks := []struct {
		panel  string
		signal string
		test   func() bool
	}{
		{"qadbakPanel", "path:/opt/qadbak", func() bool { return pathExists("/opt/qadbak") }},
		{"hestiaCP", "path:/usr/local/hestia", func() bool { return pathExists("/usr/local/hestia") }},
		{"coolify", "path:/data/coolify", func() bool { return pathExists("/data/coolify") }},
		{"casaOS", "unit:casaos", func() bool { return systemdActive("casaos") }},
		{"plesk", "path:/usr/local/psa", func() bool { return pathExists("/usr/local/psa") }},
		{"directAdmin", "path:/usr/local/directadmin", func() bool { return pathExists("/usr/local/directadmin") }},
	}

	for _, c := range checks {
		if c.test() {
			return Result{
				DetectedPanel: c.panel,
				Confidence:    "high",
				Signals:       []string{c.signal},
			}
		}
	}
	return Result{
		DetectedPanel: "genericLinux",
		Confidence:    "low",
		Signals:       []string{"no-known-panel"},
	}
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func systemdActive(unit string) bool {
	b, err := os.ReadFile("/etc/systemd/system/" + unit + ".service")
	if err == nil && len(b) > 0 {
		return true
	}
	out, err := os.ReadFile("/run/systemd/units/invocation/" + unit)
	_ = out
	return err == nil
}

func MapCapabilities(detectedPanel string, linkedPanel string) map[string]bool {
	caps := map[string]bool{
		"systemMetrics":     true,
		"logs":              true,
		"serviceManagement": true,
		"dockerManagement":  docker.Available(),
		"packageUpdates":    true,
		"reboot":            true,
		"shutdown":          true,
		"panelIntegration":  detectedPanel != "genericLinux" && detectedPanel != "",
	}
	if detectedPanel == "coolify" && !caps["dockerManagement"] {
		caps["dockerManagement"] = docker.Available()
	}
	switch linkedPanel {
	case "hestiaCP":
		caps["domainHosting"] = true
	case "coolify", "casaOS":
		caps["panelApps"] = true
	}
	return caps
}

func NormalizePanelKind(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "genericLinux"
	}
	return raw
}

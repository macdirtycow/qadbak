package panels

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

type WebsiteProbeResult struct {
	OK         bool   `json:"ok,omitempty"`
	Status     int    `json:"status,omitempty"`
	Error      string `json:"error,omitempty"`
	DNSPending bool   `json:"dnsPending,omitempty"`
}

type WebsiteStackResult struct {
	SSLDaysLeft   *int `json:"sslDaysLeft,omitempty"`
	BackupAgeDays *int `json:"backupAgeDays,omitempty"`
}

type WebsiteHealthResult struct {
	Domain          string              `json:"domain"`
	RepairAvailable bool                `json:"repairAvailable"`
	PublicProbe     WebsiteProbeResult  `json:"publicProbe"`
	LocalProbe      WebsiteProbeResult  `json:"localProbe"`
	Stack           *WebsiteStackResult `json:"stack,omitempty"`
}

func HestiaWebsiteHealth(cfg LinkConfig, domain string) (WebsiteHealthResult, error) {
	public := probeURL("https://" + domain, "")
	local := probeURL("http://127.0.0.1/", domain)

	stack := &WebsiteStackResult{}
	if days, err := hestiaSSLDaysLeft(cfg, domain); err == nil {
		stack.SSLDaysLeft = &days
	}
	if age, err := hestiaBackupAgeDays(cfg, domain); err == nil {
		stack.BackupAgeDays = &age
	}

	return WebsiteHealthResult{
		Domain:          domain,
		RepairAvailable: false,
		PublicProbe:     public,
		LocalProbe:      local,
		Stack:           stack,
	}, nil
}

func probeURL(url, hostHeader string) WebsiteProbeResult {
	client := &http.Client{Timeout: 12 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return WebsiteProbeResult{OK: false, Error: err.Error()}
	}
	if hostHeader != "" {
		req.Host = hostHeader
	}
	resp, err := client.Do(req)
	if err != nil {
		msg := err.Error()
		dnsPending := strings.Contains(strings.ToLower(msg), "no such host") ||
			strings.Contains(strings.ToLower(msg), "name or service not known")
		return WebsiteProbeResult{OK: false, Error: msg, DNSPending: dnsPending}
	}
	defer resp.Body.Close()
	ok := resp.StatusCode >= 200 && resp.StatusCode < 500
	return WebsiteProbeResult{OK: ok, Status: resp.StatusCode}
}

func hestiaSSLDaysLeft(cfg LinkConfig, domain string) (int, error) {
	certs, err := HestiaListSSL(cfg, domain)
	if err != nil || len(certs) == 0 {
		return 0, fmt.Errorf("no ssl")
	}
	expires := strings.TrimSpace(certs[0].Expires)
	if expires == "" {
		return 0, fmt.Errorf("no expiry")
	}
	layouts := []string{"2006-01-02", time.RFC3339, "2006-01-02 15:04:05"}
	var parsed time.Time
	var parseErr error
	for _, layout := range layouts {
		parsed, parseErr = time.Parse(layout, expires)
		if parseErr == nil {
			break
		}
	}
	if parseErr != nil {
		return 0, parseErr
	}
	days := int(time.Until(parsed).Hours() / 24)
	return days, nil
}

func hestiaBackupAgeDays(cfg LinkConfig, domain string) (int, error) {
	payload, err := HestiaListBackups(cfg, domain)
	if err != nil {
		return 0, err
	}
	if len(payload.Scheduled) == 0 {
		return 0, fmt.Errorf("no backups")
	}
	// Best-effort: stale if no archives listed.
	return 30, nil
}

func HestiaWebsiteLogs(cfg LinkConfig, domain, logType string) (string, error) {
	for _, path := range hestiaLogPaths(domain, logType) {
		text, err := privilege.LogTail(path, 250)
		if err == nil && text != "" {
			return text, nil
		}
	}
	return "", fmt.Errorf("could not read %s log for %s", logType, domain)
}

func hestiaLogPaths(domain, logType string) []string {
	domain = strings.TrimSpace(domain)
	switch strings.ToLower(strings.TrimSpace(logType)) {
	case "error":
		return []string{
			fmt.Sprintf("/var/log/nginx/domains/%s.error.log", domain),
			fmt.Sprintf("/var/log/apache2/domains/%s.error.log", domain),
			fmt.Sprintf("/var/log/nginx/%s.error.log", domain),
		}
	default:
		return []string{
			fmt.Sprintf("/var/log/nginx/domains/%s.log", domain),
			fmt.Sprintf("/var/log/apache2/domains/%s.log", domain),
			fmt.Sprintf("/var/log/nginx/%s.log", domain),
		}
	}
}

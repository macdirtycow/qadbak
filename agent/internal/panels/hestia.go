package panels

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func defaultHestiaBase() string { return "https://127.0.0.1:8083" }

func fetchHestiaOverview(cfg LinkConfig) (Overview, error) {
	base := strings.TrimSpace(cfg.BaseURL)
	if base == "" {
		base = defaultHestiaBase()
	}
	user := strings.TrimSpace(cfg.Secrets["username"])
	pass := strings.TrimSpace(cfg.Secrets["password"])
	accessKey := strings.TrimSpace(cfg.Secrets["accessKey"])
	secretKey := strings.TrimSpace(cfg.Secrets["secretKey"])
	if accessKey != "" && secretKey != "" {
		user = accessKey
		pass = secretKey
	}
	if user == "" || pass == "" {
		return Overview{}, fmt.Errorf("hestia credentials required (username/password or access key + secret)")
	}

	sysRaw, err := hestiaCmd(base, user, pass, "v-list-sys-info")
	if err != nil {
		return Overview{}, err
	}
	usersRaw, err := hestiaCmd(base, user, pass, "v-list-users")
	if err != nil {
		return Overview{}, err
	}

	overview := Overview{Panel: "hestiaCP"}
	var sys map[string]any
	if json.Unmarshal(sysRaw, &sys) == nil {
		if v, ok := sys["VERSION"].(string); ok {
			overview.PanelVersion = v
		}
		if v, ok := sys["HOSTNAME"].(string); ok {
			overview.Hostname = v
		}
	}
	userCount := 0
	var users map[string]any
	if json.Unmarshal(usersRaw, &users) == nil {
		userCount = len(users)
	}

	domainCount := 0
	if domainsRaw, err := hestiaCmd(base, user, pass, "v-list-web-domains", user); err == nil {
		var domains map[string]any
		if json.Unmarshal(domainsRaw, &domains) == nil {
			domainCount = len(domains)
		}
	}

	overview.Summary = map[string]any{
		"users":   userCount,
		"domains": domainCount,
	}
	overview.Notes = []string{
		"Read-only via Hestia API on this server.",
		"Domain and mail changes stay in the Hestia panel for now.",
	}
	return overview, nil
}

func hestiaCmd(baseURL, user, pass, cmd string, args ...string) ([]byte, error) {
	form := url.Values{}
	form.Set("user", user)
	form.Set("password", pass)
	form.Set("returncode", "yes")
	form.Set("cmd", cmd)
	for i, arg := range args {
		form.Set(fmt.Sprintf("arg%d", i+1), arg)
	}

	client := &http.Client{
		Timeout: 20 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // local panel API
		},
	}
	endpoint := strings.TrimRight(baseURL, "/") + "/api/"
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hestia api: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("hestia api HTTP %d", res.StatusCode)
	}
	text := strings.TrimSpace(string(body))
	if text == "" || text == "OK" {
		return body, nil
	}
	if strings.HasPrefix(text, "Error:") {
		return nil, fmt.Errorf("%s", text)
	}
	return body, nil
}

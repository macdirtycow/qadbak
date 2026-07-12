package panels

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type hestiaClient struct {
	baseURL string
	user    string
	pass    string
}

func newHestiaClient(cfg LinkConfig) (*hestiaClient, error) {
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
		return nil, fmt.Errorf("hestia credentials required")
	}
	return &hestiaClient{baseURL: base, user: user, pass: pass}, nil
}

func (c *hestiaClient) call(cmd string, args ...string) ([]byte, error) {
	return hestiaCmd(c.baseURL, c.user, c.pass, cmd, args...)
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
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // local panel
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
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("hestia api HTTP %d", res.StatusCode)
	}
	text := strings.TrimSpace(string(body))
	if strings.HasPrefix(text, "Error:") {
		return nil, fmt.Errorf("%s", text)
	}
	return body, nil
}

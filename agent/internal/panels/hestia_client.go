package panels

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/httploopback"
)

type hestiaAuthMode int

const (
	hestiaAuthAccessKey hestiaAuthMode = iota
	hestiaAuthLegacyUser
)

type hestiaAuth struct {
	mode      hestiaAuthMode
	accessKey string
	secretKey string
	user      string
	password  string
}

type hestiaClient struct {
	endpoint LoopbackEndpoint
	auth     hestiaAuth
	client   *http.Client
}

func newHestiaClient(cfg LinkConfig) (*hestiaClient, error) {
	endpoint, err := ResolveLoopbackEndpoint(cfg.BaseURL, "https", 8083)
	if err != nil {
		return nil, err
	}

	accessKey := strings.TrimSpace(cfg.Secrets["accessKey"])
	secretKey := strings.TrimSpace(cfg.Secrets["secretKey"])
	user := strings.TrimSpace(cfg.Secrets["username"])
	pass := strings.TrimSpace(cfg.Secrets["password"])

	var auth hestiaAuth
	switch {
	case accessKey != "" && secretKey != "":
		auth = hestiaAuth{mode: hestiaAuthAccessKey, accessKey: accessKey, secretKey: secretKey}
	case user != "" && pass != "":
		auth = hestiaAuth{mode: hestiaAuthLegacyUser, user: user, password: pass}
	default:
		return nil, fmt.Errorf("hestia credentials required (access key + secret key, or admin username + password)")
	}

	return &hestiaClient{
		endpoint: endpoint,
		auth:     auth,
		client:   httploopback.ClientWithServerName(endpoint.scheme, endpoint.port, hestiaTLSServerName()),
	}, nil
}

func (c *hestiaClient) call(cmd string, args ...string) ([]byte, error) {
	return c.exec(cmd, args...)
}

func (c *hestiaClient) exec(cmd string, args ...string) ([]byte, error) {
	form := url.Values{}
	form.Set("cmd", cmd)
	for i, arg := range args {
		form.Set(fmt.Sprintf("arg%d", i+1), arg)
	}

	switch c.auth.mode {
	case hestiaAuthAccessKey:
		form.Set("access_key", c.auth.accessKey)
		form.Set("secret_key", c.auth.secretKey)
	default:
		form.Set("user", c.auth.user)
		form.Set("password", c.auth.password)
	}

	req, err := http.NewRequest(http.MethodPost, httploopback.RequestURL(c.endpoint.scheme, c.endpoint.port, "/api/"), strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := httploopback.Do(c.client, req)
	if err != nil {
		return nil, fmt.Errorf("hestia api: %w", err)
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	return parseHestiaResponse(res, body)
}

func parseHestiaResponse(res *http.Response, body []byte) ([]byte, error) {
	text := strings.TrimSpace(string(body))

	if code := strings.TrimSpace(res.Header.Get("Hestia-Exit-Code")); code != "" {
		if code != "0" {
			if text == "" {
				return nil, fmt.Errorf("hestia command failed (exit %s)", code)
			}
			return nil, fmt.Errorf("hestia command failed (exit %s): %s", code, text)
		}
	}

	switch res.StatusCode {
	case http.StatusNoContent:
		return nil, nil
	case http.StatusOK:
		if text == "" || text == "OK" {
			return nil, nil
		}
		if strings.HasPrefix(text, "Error:") {
			return nil, fmt.Errorf("%s", text)
		}
		return body, nil
	default:
		if text == "" {
			return nil, fmt.Errorf("hestia api HTTP %d", res.StatusCode)
		}
		if strings.HasPrefix(text, "Error:") {
			return nil, fmt.Errorf("%s", text)
		}
		if n, err := strconv.Atoi(text); err == nil && n != 0 && res.StatusCode >= 400 {
			return nil, fmt.Errorf("hestia command failed (exit %d)", n)
		}
		return nil, fmt.Errorf("hestia api HTTP %d: %s", res.StatusCode, text)
	}
}

// testHestiaClient wires a client to an httptest server (tests only).
func testHestiaClient(server *httptest.Server, auth hestiaAuth) *hestiaClient {
	ep, _ := ResolveLoopbackEndpoint(server.URL, "http", 80)
	return &hestiaClient{
		endpoint: ep,
		auth:     auth,
		client:   httploopback.Client(ep.scheme, ep.port),
	}
}

package panels

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/httploopback"
)

func defaultCasaOSBase() string { return "http://127.0.0.1" }

func fetchCasaOSOverview(cfg LinkConfig) (Overview, error) {
	endpoint, err := ResolveLoopbackEndpoint(cfg.BaseURL, "http", 80)
	if err != nil {
		return Overview{}, err
	}

	token := strings.TrimSpace(cfg.Secrets["apiToken"])
	if token == "" {
		user := strings.TrimSpace(cfg.Secrets["username"])
		pass := strings.TrimSpace(cfg.Secrets["password"])
		if user == "" || pass == "" {
			return Overview{}, fmt.Errorf("casaOS apiToken or username/password required")
		}
		var err error
		token, err = casaOSLogin(endpoint, user, pass)
		if err != nil {
			return Overview{}, err
		}
	}

	appsRaw, err := casaOSGET(endpoint, token, "/v2/app/my")
	if err != nil {
		return Overview{}, err
	}
	sysRaw, _ := casaOSGET(endpoint, token, "/v1/sys/info")

	overview := Overview{
		Panel: "casaOS",
		Notes: []string{
			"Read-only via CasaOS API on this server.",
			"App installs and shares stay in the CasaOS UI for now.",
		},
	}

	var sys map[string]any
	if json.Unmarshal(sysRaw, &sys) == nil {
		if data, ok := sys["data"].(map[string]any); ok {
			if v, ok := data["version"].(string); ok {
				overview.PanelVersion = v
			}
			if v, ok := data["hostname"].(string); ok {
				overview.Hostname = v
			}
		}
	}

	var appsEnvelope struct {
		Data []map[string]any `json:"data"`
	}
	if json.Unmarshal(appsRaw, &appsEnvelope) == nil {
		overview.Summary = map[string]any{"applications": len(appsEnvelope.Data)}
		for i, app := range appsEnvelope.Data {
			if i >= 12 {
				break
			}
			name, _ := app["name"].(string)
			status, _ := app["status"].(string)
			id := fmt.Sprintf("%v", app["id"])
			overview.Items = append(overview.Items, OverviewItem{
				ID:     id,
				Title:  name,
				Status: status,
			})
		}
	}

	return overview, nil
}

func casaOSLogin(endpoint LoopbackEndpoint, username, password string) (string, error) {
	payload, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})
	client := httploopback.Client(endpoint.scheme, endpoint.port)
	req, err := http.NewRequest(http.MethodPost, httploopback.RequestURL(endpoint.scheme, endpoint.port, "/v2/users/login"), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("casaos login: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("casaos login failed")
	}
	var envelope struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", err
	}
	if envelope.Data.Token == "" {
		return "", fmt.Errorf("casaos login returned no token")
	}
	return envelope.Data.Token, nil
}

func casaOSGET(endpoint LoopbackEndpoint, token, path string) ([]byte, error) {
	if !strings.HasPrefix(path, "/") || strings.Contains(path, "..") {
		return nil, fmt.Errorf("invalid casaos path")
	}
	client := httploopback.Client(endpoint.scheme, endpoint.port)
	req, err := http.NewRequest(http.MethodGet, httploopback.RequestURL(endpoint.scheme, endpoint.port, path), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", token)
	req.Header.Set("Accept", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("casaos api: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("casaos api HTTP %d", res.StatusCode)
	}
	return body, nil
}

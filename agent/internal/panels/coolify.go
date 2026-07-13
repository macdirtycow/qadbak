package panels

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func defaultCoolifyBase() string { return "http://127.0.0.1:8000" }

func fetchCoolifyOverview(cfg LinkConfig) (Overview, error) {
	base := ResolvePanelBaseURL(cfg.BaseURL, defaultCoolifyBase)
	token := strings.TrimSpace(cfg.Secrets["apiToken"])
	if token == "" {
		return Overview{}, fmt.Errorf("coolify apiToken required")
	}

	appsRaw, err := coolifyGET(base, token, "/api/v1/applications")
	if err != nil {
		return Overview{}, err
	}
	projectsRaw, _ := coolifyGET(base, token, "/api/v1/projects")

	overview := Overview{
		Panel: "coolify",
		Notes: []string{
			"Managed via Coolify API through the Qadbak agent.",
		},
	}

	var apps []map[string]any
	if json.Unmarshal(appsRaw, &apps) == nil {
		overview.Summary = map[string]any{"applications": len(apps)}
		for i, app := range apps {
			if i >= 12 {
				break
			}
			name, _ := app["name"].(string)
			fqdn, _ := app["fqdn"].(string)
			status, _ := app["status"].(string)
			id := fmt.Sprintf("%v", app["id"])
			overview.Items = append(overview.Items, OverviewItem{
				ID:     id,
				Title:  name,
				Detail: fqdn,
				Status: status,
			})
		}
	}

	var projects []map[string]any
	if json.Unmarshal(projectsRaw, &projects) == nil {
		if overview.Summary == nil {
			overview.Summary = map[string]any{}
		}
		overview.Summary["projects"] = len(projects)
	}

	return overview, nil
}

func coolifyGET(baseURL, token, path string) ([]byte, error) {
	return coolifyRequest(baseURL, token, http.MethodGet, path, nil)
}

func coolifyRequest(baseURL, token, method, path string, body []byte) ([]byte, error) {
	base, err := ValidatePanelBaseURL(baseURL)
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(path, "/") {
		return nil, fmt.Errorf("invalid coolify path")
	}
	client := &http.Client{Timeout: 30 * time.Second}
	endpoint := strings.TrimRight(base, "/") + path
	var reader io.Reader
	if body != nil {
		reader = strings.NewReader(string(body))
	}
	req, err := http.NewRequest(method, endpoint, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("coolify api: %w", err)
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		msg := strings.TrimSpace(string(respBody))
		if msg == "" {
			msg = res.Status
		}
		return nil, fmt.Errorf("coolify api: %s", msg)
	}
	return respBody, nil
}

package panels

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type PanelApp struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Status  string `json:"status,omitempty"`
	Detail  string `json:"detail,omitempty"`
	Image   string `json:"image,omitempty"`
	Project string `json:"project,omitempty"`
}

func CoolifyListApps(cfg LinkConfig) ([]PanelApp, error) {
	base := strings.TrimSpace(cfg.BaseURL)
	if base == "" {
		base = defaultCoolifyBase()
	}
	token := strings.TrimSpace(cfg.Secrets["apiToken"])
	if token == "" {
		return nil, fmt.Errorf("coolify apiToken required")
	}
	raw, err := coolifyGET(base, token, "/api/v1/applications")
	if err != nil {
		return nil, err
	}
	var apps []map[string]any
	if json.Unmarshal(raw, &apps) != nil {
		return nil, fmt.Errorf("coolify: invalid applications response")
	}
	out := make([]PanelApp, 0, len(apps))
	for _, app := range apps {
		out = append(out, PanelApp{
			ID:     fmt.Sprintf("%v", app["id"]),
			Name:   strVal(app["name"]),
			Status: strVal(app["status"]),
			Detail: strVal(app["fqdn"]),
			Image:  strVal(app["docker_image"]),
		})
	}
	return out, nil
}

func CoolifyDeployApp(cfg LinkConfig, id string) error {
	return coolifyPOST(cfg, "/api/v1/applications/"+urlPathEscape(id)+"/deploy", nil)
}

func CoolifyStartApp(cfg LinkConfig, id string) error {
	return coolifyPOST(cfg, "/api/v1/applications/"+urlPathEscape(id)+"/start", nil)
}

func CoolifyStopApp(cfg LinkConfig, id string) error {
	return coolifyPOST(cfg, "/api/v1/applications/"+urlPathEscape(id)+"/stop", nil)
}

func coolifyPOST(cfg LinkConfig, path string, body []byte) error {
	base := strings.TrimSpace(cfg.BaseURL)
	if base == "" {
		base = defaultCoolifyBase()
	}
	token := strings.TrimSpace(cfg.Secrets["apiToken"])
	if token == "" {
		return fmt.Errorf("coolify apiToken required")
	}
	_, err := coolifyRequest(base, token, http.MethodPost, path, body)
	return err
}

func strVal(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func urlPathEscape(id string) string {
	return strings.TrimSpace(id)
}

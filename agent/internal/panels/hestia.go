package panels

import (
	"encoding/json"
)

func defaultHestiaBase() string { return "https://127.0.0.1:8083" }

func fetchHestiaOverview(cfg LinkConfig) (Overview, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return Overview{}, err
	}

	sysRaw, err := c.call("v-list-sys-info")
	if err != nil {
		return Overview{}, err
	}
	usersRaw, err := c.call("v-list-users")
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

	domains, _ := HestiaListDomains(cfg)

	overview.Summary = map[string]any{
		"users":   userCount,
		"domains": len(domains),
	}
	overview.Notes = []string{
		"Managed via Hestia API through the Qadbak agent.",
	}
	return overview, nil
}

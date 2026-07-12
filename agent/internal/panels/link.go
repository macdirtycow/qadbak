package panels

import (
	"errors"
	"strings"
)

var openSourcePanels = map[string]bool{
	"hestiaCP": true,
	"coolify":  true,
	"casaOS":   true,
}

func IsOpenSource(panel string) bool {
	return openSourcePanels[strings.TrimSpace(panel)]
}

func IsLinkable(panel string) bool {
	return IsOpenSource(panel)
}

// Overview is a read-only snapshot from a linked panel API.
type Overview struct {
	Panel       string            `json:"panel"`
	PanelVersion string           `json:"panelVersion,omitempty"`
	Hostname    string            `json:"hostname,omitempty"`
	Summary     map[string]any    `json:"summary,omitempty"`
	Items       []OverviewItem    `json:"items,omitempty"`
	Notes       []string          `json:"notes,omitempty"`
}

type OverviewItem struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
	Status string `json:"status,omitempty"`
}

func FetchOverview(cfg LinkConfig) (Overview, error) {
	switch cfg.Panel {
	case "hestiaCP":
		return fetchHestiaOverview(cfg)
	case "coolify":
		return fetchCoolifyOverview(cfg)
	case "casaOS":
		return fetchCasaOSOverview(cfg)
	default:
		return Overview{}, errors.New("panel linking is not supported for " + cfg.Panel)
	}
}

func TestLink(cfg LinkConfig) error {
	_, err := FetchOverview(cfg)
	return err
}

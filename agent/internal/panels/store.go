package panels

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var ErrNotLinked = errors.New("panel not linked")

// LinkConfig holds credentials the agent uses to call a local panel API.
// Stored on disk with mode 0600 — never returned to clients in full.
type LinkConfig struct {
	Panel    string            `json:"panel"`
	BaseURL  string            `json:"baseUrl,omitempty"`
	Secrets  map[string]string `json:"secrets"`
	LinkedAt time.Time         `json:"linkedAt"`
}

// PublicStatus is safe to expose to the iOS app.
type PublicStatus struct {
	Panel      string    `json:"panel"`
	BaseURL    string    `json:"baseUrl,omitempty"`
	Linked     bool      `json:"linked"`
	LinkedAt   time.Time `json:"linkedAt,omitempty"`
	Hint       string    `json:"hint,omitempty"`
	Linkable   bool      `json:"linkable"`
	OpenSource bool      `json:"openSource"`
}

type Store struct {
	path string
}

func NewStore(dataDir string) *Store {
	return &Store{path: filepath.Join(dataDir, "panel-link.json")}
}

func (s *Store) Load() (*LinkConfig, error) {
	b, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var cfg LinkConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.Panel) == "" {
		return nil, nil
	}
	return &cfg, nil
}

func (s *Store) Save(cfg LinkConfig) error {
	if cfg.LinkedAt.IsZero() {
		cfg.LinkedAt = time.Now().UTC()
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o750); err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Store) Delete() error {
	err := os.Remove(s.path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func PublicFromConfig(cfg *LinkConfig, detectedPanel string) PublicStatus {
	linkable := IsLinkable(detectedPanel)
	st := PublicStatus{
		Panel:      detectedPanel,
		Linked:     cfg != nil,
		Linkable:   linkable,
		OpenSource: IsOpenSource(detectedPanel),
	}
	if cfg == nil {
		if linkable {
			if detectedPanel == "hestiaCP" {
				st.Hint = "Tap Link HestiaCP to auto-create an API key on this server."
			} else {
				st.Hint = "Add panel API credentials to read sites and apps from the iOS app."
			}
		}
		return st
	}
	st.Panel = cfg.Panel
	st.BaseURL = cfg.BaseURL
	st.LinkedAt = cfg.LinkedAt
	if hint := cfg.Secrets["username"]; hint != "" {
		st.Hint = "Linked as " + hint
	} else if hint := cfg.Secrets["accessKey"]; hint != "" {
		st.Hint = "Linked with access key " + maskSecret(hint)
	} else if hint := cfg.Secrets["apiToken"]; hint != "" {
		st.Hint = "Linked with API token " + maskSecret(hint)
	}
	return st
}

func maskSecret(s string) string {
	s = strings.TrimSpace(s)
	if len(s) <= 4 {
		return "****"
	}
	return s[:2] + "…" + s[len(s)-2:]
}

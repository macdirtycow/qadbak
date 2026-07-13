package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/detection"
	"github.com/macdirtycow/qadbak/agent/internal/panels"
)

type panelLinkBody struct {
	Panel     string            `json:"panel"`
	BaseURL   string            `json:"baseUrl"`
	Username  string            `json:"username"`
	Password  string            `json:"password"`
	AccessKey string            `json:"accessKey"`
	SecretKey string            `json:"secretKey"`
	APIToken  string            `json:"apiToken"`
}

func (h *Handler) panelLinkRoute(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.panelLinkStatus(w, r)
	case http.MethodPost:
		h.panelLinkCreate(w, r)
	case http.MethodDelete:
		h.panelLinkDelete(w, r)
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelLinkStatus(w http.ResponseWriter, r *http.Request) {
	detected := detection.DetectPanel().DetectedPanel
	store := panels.NewStore(h.cfg.DataDir)
	cfg, _ := store.Load()
	status := panels.PublicFromConfig(cfg, detected)
	payload := map[string]any{
		"ok":            true,
		"detectedPanel": detected,
		"status":        status,
	}
	if detected == "hestiaCP" || panels.HestiaInstalled() {
		payload["hestiaSetup"] = panels.BuildHestiaSetupInfo()
	}
	WriteJSON(w, http.StatusOK, payload)
}

func (h *Handler) panelLinkCreate(w http.ResponseWriter, r *http.Request) {
	var body panelLinkBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}

	detected := detection.DetectPanel().DetectedPanel
	panel := strings.TrimSpace(body.Panel)
	if panel == "" {
		panel = detected
	}
	if !panels.IsLinkable(panel) {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"ok":    false,
			"error": "Panel linking is available for HestiaCP, Coolify, and CasaOS only.",
		})
		return
	}
	if panel != detected && detected != "genericLinux" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"ok":    false,
			"error": "Detected panel is " + detected + "; choose matching credentials.",
		})
		return
	}

	secrets := map[string]string{}
	if u := strings.TrimSpace(body.Username); u != "" {
		secrets["username"] = u
	}
	if p := strings.TrimSpace(body.Password); p != "" {
		secrets["password"] = p
	}
	if k := strings.TrimSpace(body.AccessKey); k != "" {
		secrets["accessKey"] = k
	}
	if k := strings.TrimSpace(body.SecretKey); k != "" {
		secrets["secretKey"] = k
	}
	if t := strings.TrimSpace(body.APIToken); t != "" {
		secrets["apiToken"] = t
	}

	cfg := panels.LinkConfig{
		Panel:    panel,
		BaseURL:  strings.TrimSpace(body.BaseURL),
		Secrets:  secrets,
		LinkedAt: time.Now().UTC(),
	}
	hestiaPanelDefaults(&cfg)

	if err := panels.TestLink(cfg); err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	store := panels.NewStore(h.cfg.DataDir)
	if err := store.Save(cfg); err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not save panel link"})
		return
	}
	h.audit.Record("panels.link", panel, panel, clientIP(r), "ok")
	status := panels.PublicFromConfig(&cfg, detected)
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"status":       status,
		"capabilities": h.capabilitiesMap(),
	})
}

func (h *Handler) panelLinkDelete(w http.ResponseWriter, r *http.Request) {
	store := panels.NewStore(h.cfg.DataDir)
	cfg, _ := store.Load()
	if err := store.Delete(); err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not remove panel link"})
		return
	}
	target := "panel"
	if cfg != nil {
		target = cfg.Panel
	}
	h.audit.Record("panels.unlink", target, target, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"capabilities": h.capabilitiesMap(),
	})
}

func (h *Handler) panelOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	store := panels.NewStore(h.cfg.DataDir)
	cfg, err := store.Load()
	if err != nil || cfg == nil {
		WriteJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "Panel not linked"})
		return
	}
	overview, err := panels.FetchOverview(*cfg)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "overview": overview})
}

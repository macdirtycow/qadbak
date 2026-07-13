package handlers

import (
	"net/http"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/detection"
	"github.com/macdirtycow/qadbak/agent/internal/panels"
)

func (h *Handler) hestiaSetupRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	detected := detection.DetectPanel().DetectedPanel
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"detectedPanel": detected,
		"hestiaSetup": panels.BuildHestiaSetupInfo(),
	})
}

type hestiaBootstrapBody struct {
	AutoLink bool `json:"autoLink"`
}

func (h *Handler) hestiaBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if detection.DetectPanel().DetectedPanel != "hestiaCP" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"ok":    false,
			"error": "HestiaCP is not installed on this server.",
		})
		return
	}

	var body hestiaBootstrapBody
	_ = decodeJSON(r, &body)

	result, err := panels.HestiaBootstrap()
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record("panels.hestia.bootstrap", "hestiaCP", result.AccessKey, clientIP(r), "ok")

	resp := map[string]any{
		"ok":       true,
		"baseUrl":  result.BaseURL,
		"accessKey": result.AccessKey,
		"secretKey": result.SecretKey,
		"comment":  result.Comment,
	}

	if body.AutoLink {
		cfg := panels.LinkConfig{
			Panel:   "hestiaCP",
			BaseURL: result.BaseURL,
			Secrets: map[string]string{
				"accessKey": result.AccessKey,
				"secretKey": result.SecretKey,
			},
			LinkedAt: time.Now().UTC(),
		}
		if err := panels.TestLink(cfg); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{
				"ok":        false,
				"error":     "Access key created but link test failed: " + err.Error(),
				"accessKey": result.AccessKey,
				"secretKey": result.SecretKey,
				"baseUrl":   result.BaseURL,
			})
			return
		}
		store := panels.NewStore(h.cfg.DataDir)
		if err := store.Save(cfg); err != nil {
			WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not save panel link"})
			return
		}
		h.audit.Record("panels.link", "hestiaCP", "hestiaCP", clientIP(r), "ok")
		detected := detection.DetectPanel().DetectedPanel
		status := panels.PublicFromConfig(&cfg, detected)
		resp["linked"] = true
		resp["status"] = status
		resp["capabilities"] = h.capabilitiesMap()
	}

	WriteJSON(w, http.StatusOK, resp)
}

func hestiaPanelDefaults(cfg *panels.LinkConfig) {
	if cfg == nil || cfg.Panel != "hestiaCP" {
		return
	}
	cfg.BaseURL = panels.NormalizeHestiaBaseURL(cfg.BaseURL)
	_ = panels.HestiaEnsureLoopbackAPI()
}

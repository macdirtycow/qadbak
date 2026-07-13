package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/audit"
	"github.com/macdirtycow/qadbak/agent/internal/auth"
	"github.com/macdirtycow/qadbak/agent/internal/config"
	"github.com/macdirtycow/qadbak/agent/internal/detection"
	"github.com/macdirtycow/qadbak/agent/internal/docker"
	"github.com/macdirtycow/qadbak/agent/internal/logs"
	"github.com/macdirtycow/qadbak/agent/internal/system"
	"github.com/macdirtycow/qadbak/agent/internal/tlsutil"
)

type Handler struct {
	cfg     *config.Config
	store   *auth.Store
	cert    string
	audit   *audit.Logger
	metrics *system.MetricsHistory
	mu      sync.Mutex
	rate    map[string][]time.Time
}

func New(cfg *config.Config, store *auth.Store, certPath string) *Handler {
	log, _ := audit.NewLogger(cfg.DataDir)
	return &Handler{
		cfg:     cfg,
		store:   store,
		cert:    certPath,
		audit:   log,
		metrics: system.NewMetricsHistory(cfg.DataDir),
		rate:    map[string][]time.Time{},
	}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/health", h.health)
	mux.HandleFunc("/api/v1/version", h.version)
	mux.HandleFunc("/api/v1/pairing/init", h.pairingInit)
	mux.HandleFunc("/api/v1/pairing/complete", h.pairingComplete)
	mux.HandleFunc("/api/v1/auth/rotate", h.authRotate)
	mux.HandleFunc("/api/v1/auth/revoke", h.withAuthDevice(h.authRevoke))
	mux.HandleFunc("/api/v1/capabilities", h.withAuth(h.capabilities))
	mux.HandleFunc("/api/v1/system/overview", h.withAuth(h.systemOverview))
	mux.HandleFunc("/api/v1/system/metrics", h.withAuth(h.systemMetrics))
	mux.HandleFunc("/api/v1/audit", h.withAuth(h.auditLog))
	mux.HandleFunc("/api/v1/detection/panel", h.withAuth(h.panelDetection))
	mux.HandleFunc("/api/v1/panels/link", h.withAuth(h.panelLinkRoute))
	mux.HandleFunc("/api/v1/panels/hestia/setup", h.withAuth(h.hestiaSetupRoute))
	mux.HandleFunc("/api/v1/panels/hestia/bootstrap", h.withAuth(h.hestiaBootstrap))
	mux.HandleFunc("/api/v1/panels/domains", h.withAuth(h.panelDomainsRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}", h.withAuth(h.panelDomainItemRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/dns", h.withAuth(h.panelDomainDNSRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/mail", h.withAuth(h.panelDomainMailRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/ssl", h.withAuth(h.panelDomainSSLRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/aliases", h.withAuth(h.panelDomainAliasesRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/databases", h.withAuth(h.panelDomainDatabasesRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/redirects", h.withAuth(h.panelDomainRedirectsRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/cron", h.withAuth(h.panelDomainCronRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/ftp", h.withAuth(h.panelDomainFtpRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/backups", h.withAuth(h.panelDomainBackupsRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/enable", h.withAuth(h.panelDomainEnableRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/disable", h.withAuth(h.panelDomainDisableRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/website-health", h.withAuth(h.panelDomainHealthRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/logs", h.withAuth(h.panelDomainWebsiteLogsRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/files", h.withAuth(h.panelDomainFilesRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/files/content", h.withAuth(h.panelDomainFilesContentRoute))
	mux.HandleFunc("/api/v1/panels/domains/{domain}/files/upload", h.withAuth(h.panelDomainFilesUploadRoute))
	mux.HandleFunc("/api/v1/panels/widgets/summary", h.withAuth(h.panelWidgetsSummaryRoute))
	mux.HandleFunc("/api/v1/panels/apps", h.withAuth(h.panelAppsRoute))
	mux.HandleFunc("/api/v1/panels/apps/{id}/{action}", h.withAuth(h.panelAppActionRoute))
	mux.HandleFunc("/api/v1/panels/overview", h.withAuth(h.panelOverview))
	mux.HandleFunc("/api/v1/services", h.withAuth(h.servicesList))
	mux.HandleFunc("/api/v1/docker/containers", h.withAuth(h.dockerContainers))
	mux.HandleFunc("/api/v1/docker/containers/{id}/logs", h.withAuth(h.dockerContainerLogs))
	mux.HandleFunc("/api/v1/logs", h.withAuth(h.logsFetch))
	mux.HandleFunc("/api/v1/updates", h.withAuth(h.updatesCheck))
	mux.HandleFunc("/api/v1/actions/confirm", h.withAuthDevice(h.actionsConfirm))
	mux.HandleFunc("/api/v1/services/{id}/start", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.serviceControl(w, r, deviceID, "start")
	}))
	mux.HandleFunc("/api/v1/services/{id}/stop", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.serviceControl(w, r, deviceID, "stop")
	}))
	mux.HandleFunc("/api/v1/services/{id}/restart", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.serviceControl(w, r, deviceID, "restart")
	}))
	mux.HandleFunc("/api/v1/docker/containers/{id}/start", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.dockerControl(w, r, deviceID, "start")
	}))
	mux.HandleFunc("/api/v1/docker/containers/{id}/stop", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.dockerControl(w, r, deviceID, "stop")
	}))
	mux.HandleFunc("/api/v1/docker/containers/{id}/restart", h.withAuthDevice(func(w http.ResponseWriter, r *http.Request, deviceID string) {
		h.dockerControl(w, r, deviceID, "restart")
	}))
	mux.HandleFunc("/api/v1/updates/install", h.withAuthDevice(h.updatesInstall))
	mux.HandleFunc("/api/v1/agent/upgrade", h.withAuthDevice(h.agentUpgradeRoute))
	mux.HandleFunc("/api/v1/system/reboot", h.withAuthDevice(h.systemReboot))
	mux.HandleFunc("/api/v1/system/shutdown", h.withAuthDevice(h.systemShutdown))
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "status": "ready"})
}

func (h *Handler) version(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"version":         h.cfg.Version,
		"minAppVersion":   h.cfg.MinAppVersion,
		"minAgentVersion": h.cfg.MinAgentVersion,
	})
}

func (h *Handler) pairingInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !h.allowRate(r.RemoteAddr, 10, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	token, err := h.store.IssuePairingToken()
	if err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not create pairing token"})
		return
	}
	fp, _ := tlsutil.FingerprintSHA256(h.cert)
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":                   true,
		"pairingToken":         token,
		"expiresIn":            600,
		"tlsFingerprintSha256": fp,
	})
}

type pairingCompleteBody struct {
	PairingToken string `json:"pairingToken"`
	DeviceID     string `json:"deviceId"`
	DeviceLabel  string `json:"deviceLabel"`
}

func (h *Handler) pairingComplete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !h.allowRate(r.RemoteAddr, 20, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	var body pairingCompleteBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}
	body.PairingToken = strings.TrimSpace(body.PairingToken)
	body.DeviceID = strings.TrimSpace(body.DeviceID)
	if body.PairingToken == "" || body.DeviceID == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "pairingToken and deviceId required"})
		return
	}
	if err := h.store.ConsumePairingToken(body.PairingToken); err != nil {
		WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	access, refresh, exp, err := h.store.CreateSession(h.cfg.JWTSecret, body.DeviceID, strings.TrimSpace(body.DeviceLabel))
	if err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Session error"})
		return
	}
	panel := detection.DetectPanel()
	fp, _ := tlsutil.FingerprintSHA256(h.cert)
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":                   true,
		"accessToken":          access,
		"refreshToken":         refresh,
		"expiresIn":            exp,
		"tlsFingerprintSha256": fp,
		"capabilities":         h.capabilitiesMap(),
		"panelDetection":       panel,
	})
}

type rotateBody struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) authRotate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body rotateBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}
	access, refresh, exp, err := h.store.Rotate(h.cfg.JWTSecret, strings.TrimSpace(body.RefreshToken))
	if err != nil {
		WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Invalid refresh token"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"accessToken":  access,
		"refreshToken": refresh,
		"expiresIn":    exp,
	})
}

func (h *Handler) authRevoke(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body rotateBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}
	token := strings.TrimSpace(body.RefreshToken)
	if token == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "refreshToken required"})
		return
	}
	if err := h.store.RevokeRefreshToken(token); err != nil {
		WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Invalid refresh token"})
		return
	}
	h.audit.Record("auth.revoke", deviceID, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) capabilities(w http.ResponseWriter, r *http.Request) {
	panel := detection.DetectPanel()
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"capabilities": h.capabilitiesMap(),
		"panelDetection": panel,
	})
}

func (h *Handler) systemOverview(w http.ResponseWriter, r *http.Request) {
	overview := system.CollectOverview(h.cfg.Version)
	_ = h.metrics.RecordFromOverview(overview)
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "overview": overview})
}

func (h *Handler) systemMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["systemMetrics"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	tail := 60
	if t := strings.TrimSpace(r.URL.Query().Get("limit")); t != "" {
		if n, err := strconv.Atoi(t); err == nil {
			tail = n
		}
	}
	samples, err := h.metrics.List(tail)
	if err != nil {
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Could not load metrics"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "samples": samples})
}

func (h *Handler) auditLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	tail := 200
	if t := strings.TrimSpace(r.URL.Query().Get("tail")); t != "" {
		if n, err := strconv.Atoi(t); err == nil {
			tail = n
		}
	}
	entries, err := h.audit.Tail(tail)
	if err != nil {
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Could not read audit log"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "entries": entries})
}

func (h *Handler) panelDetection(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "panelDetection": detection.DetectPanel()})
}

func (h *Handler) servicesList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["serviceManagement"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	services, err := system.ListServices(200)
	if err != nil {
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Could not list services"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "services": services})
}

func (h *Handler) dockerContainers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["dockerManagement"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Docker not available", "code": "CAPABILITY_MISSING"})
		return
	}
	containers, err := docker.ListContainers(100)
	if err != nil {
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Could not list containers"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "containers": containers})
}

func (h *Handler) dockerContainerLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["dockerManagement"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Docker not available", "code": "CAPABILITY_MISSING"})
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Container id required"})
		return
	}
	tail := 200
	if t := strings.TrimSpace(r.URL.Query().Get("tail")); t != "" {
		if n, err := strconv.Atoi(t); err == nil {
			tail = n
		}
	}
	lines, err := docker.ContainerLogs(id, tail)
	if err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": err.Error(), "code": "VALIDATION_FAILED"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "lines": lines})
}

func (h *Handler) logsFetch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["logs"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	q := r.URL.Query()
	source := q.Get("source")
	if source == "" {
		source = "journal"
	}
	filter := q.Get("filter")
	cursor := q.Get("cursor")
	tail := 200
	if t := strings.TrimSpace(q.Get("tail")); t != "" {
		if n, err := strconv.Atoi(t); err == nil {
			tail = n
		}
	}
	before := q.Get("before") == "1" || strings.EqualFold(q.Get("direction"), "older")
	page, err := logs.Fetch(source, filter, cursor, tail, before)
	if err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": logs.PublicError(err), "code": "VALIDATION_FAILED"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"lines":      page.Lines,
		"nextCursor": page.NextCursor,
	})
}

func (h *Handler) withAuth(next func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Unauthorized"})
			return
		}
		if _, err := h.store.ValidateAccess(h.cfg.JWTSecret, token); err != nil {
			WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Unauthorized"})
			return
		}
		next(w, r)
	}
}

func (h *Handler) withAuthDevice(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Unauthorized"})
			return
		}
		deviceID, err := h.store.ValidateAccess(h.cfg.JWTSecret, token)
		if err != nil {
			WriteJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "Unauthorized"})
			return
		}
		next(w, r, deviceID)
	}
}

func bearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
}

func (h *Handler) allowRate(key string, max int, window time.Duration) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	list := h.rate[key]
	cutoff := now.Add(-window)
	kept := list[:0]
	for _, t := range list {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= max {
		h.rate[key] = kept
		return false
	}
	h.rate[key] = append(kept, now)
	return true
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"ok":false,"error":"Internal error"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

func methodNotAllowed(w http.ResponseWriter) {
	WriteJSON(w, http.StatusMethodNotAllowed, map[string]any{"ok": false, "error": "Method not allowed"})
}

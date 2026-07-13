package handlers

import (
	"net/http"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/detection"
	"github.com/macdirtycow/qadbak/agent/internal/panels"
)

func (h *Handler) linkedPanelConfig() (*panels.LinkConfig, error) {
	store := panels.NewStore(h.cfg.DataDir)
	cfg, err := store.Load()
	if err != nil || cfg == nil {
		return nil, panels.ErrNotLinked
	}
	return cfg, nil
}

func (h *Handler) linkedPanelKind() string {
	cfg, err := h.linkedPanelConfig()
	if err != nil || cfg == nil {
		return ""
	}
	return cfg.Panel
}

func (h *Handler) capabilitiesMap() map[string]bool {
	panel := detection.DetectPanel()
	return detection.MapCapabilities(panel.DetectedPanel, h.linkedPanelKind())
}

func (h *Handler) requireHestiaLink(w http.ResponseWriter) (*panels.LinkConfig, bool) {
	cfg, err := h.linkedPanelConfig()
	if err != nil || cfg == nil {
		WriteJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "Panel not linked"})
		return nil, false
	}
	if cfg.Panel != "hestiaCP" {
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "HestiaCP link required"})
		return nil, false
	}
	return cfg, true
}

func (h *Handler) panelDomainsRoute(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.panelDomainsList(w, r)
	case http.MethodPost:
		h.panelDomainCreate(w, r)
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainsList(w http.ResponseWriter, r *http.Request) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	domains, err := panels.HestiaListDomains(*cfg)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "domains": domains})
}

type createDomainBody struct {
	Domain string `json:"domain"`
	User   string `json:"user"`
	IP     string `json:"ip"`
}

func (h *Handler) panelDomainCreate(w http.ResponseWriter, r *http.Request) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	if err := h.requireConfirm(r, "panel.domain.create", "*"); err != nil {
		writeConfirmError(w, err)
		return
	}
	var body createDomainBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}
	domain := strings.TrimSpace(body.Domain)
	user := strings.TrimSpace(body.User)
	if user == "" {
		user = cfg.Secrets["username"]
	}
	if domain == "" || user == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "domain and user required"})
		return
	}
	if err := panels.HestiaCreateDomain(*cfg, user, domain, strings.TrimSpace(body.IP)); err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record("panel.domain.create", domain, user, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "domain": domain})
}

func (h *Handler) panelDomainItemRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	if domain == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "domain required"})
		return
	}
	switch r.Method {
	case http.MethodDelete:
		h.panelDomainDelete(w, r, domain)
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainDelete(w http.ResponseWriter, r *http.Request, domain string) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	if err := h.requireConfirm(r, "panel.domain.delete", domain); err != nil {
		writeConfirmError(w, err)
		return
	}
	if err := panels.HestiaDeleteDomain(*cfg, domain); err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record("panel.domain.delete", domain, domain, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) panelDomainDNSRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		records, err := panels.HestiaListDNS(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "records": records})
	case http.MethodPost:
		var rec panels.DnsRecord
		if err := decodeJSON(r, &rec); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddDNS(*cfg, domain, rec); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "id query required"})
			return
		}
		if err := panels.HestiaDeleteDNS(*cfg, domain, id); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainMailRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		users, err := panels.HestiaListMail(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "users": users})
	case http.MethodPost:
		var body struct {
			User     string `json:"user"`
			Password string `json:"password"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddMail(*cfg, domain, strings.TrimSpace(body.User), body.Password); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		user := strings.TrimSpace(r.URL.Query().Get("user"))
		if user == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "user query required"})
			return
		}
		if err := panels.HestiaDeleteMail(*cfg, domain, user); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodPatch:
		var body struct {
			User     string `json:"user"`
			Password string `json:"password"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		user := strings.TrimSpace(body.User)
		if user == "" || body.Password == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "user and password required"})
			return
		}
		if err := panels.HestiaChangeMailPassword(*cfg, domain, user, body.Password); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainSSLRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		certs, err := panels.HestiaListSSL(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "certificates": certs})
	case http.MethodPost:
		if err := panels.HestiaIssueSSL(*cfg, domain); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainAliasesRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		aliases, err := panels.HestiaListAliases(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "aliases": aliases})
	case http.MethodPost:
		var body struct {
			From string `json:"from"`
			To   string `json:"to"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddAlias(*cfg, domain, body.From, body.To); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		from := strings.TrimSpace(r.URL.Query().Get("from"))
		if from == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "from query required"})
			return
		}
		if err := panels.HestiaDeleteAlias(*cfg, domain, from); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainDatabasesRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		dbs, err := panels.HestiaListDatabases(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "databases": dbs})
	case http.MethodPost:
		var body struct {
			Name     string `json:"name"`
			User     string `json:"user"`
			Password string `json:"password"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddDatabase(*cfg, domain, body.Name, body.User, body.Password); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		name := strings.TrimSpace(r.URL.Query().Get("name"))
		if name == "" {
			var body struct {
				Name string `json:"name"`
			}
			if err := decodeJSON(r, &body); err == nil {
				name = strings.TrimSpace(body.Name)
			}
		}
		if name == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "name required"})
			return
		}
		if err := panels.HestiaDeleteDatabase(*cfg, domain, name); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodPatch:
		var body struct {
			Name     string `json:"name"`
			Password string `json:"password"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		name := strings.TrimSpace(body.Name)
		if name == "" || body.Password == "" {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "name and password required"})
			return
		}
		if err := panels.HestiaChangeDatabasePassword(*cfg, domain, name, body.Password); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainRedirectsRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		redirects, err := panels.HestiaListRedirects(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "redirects": redirects})
	case http.MethodPost:
		var body struct {
			Path string `json:"path"`
			Dest string `json:"dest"`
			Type string `json:"type"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddRedirect(*cfg, domain, body.Path, body.Dest, body.Type); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		var body struct {
			Path string `json:"path"`
		}
		_ = decodeJSON(r, &body)
		if err := panels.HestiaDeleteRedirect(*cfg, domain); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainCronRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		jobs, canEdit, err := panels.HestiaListCronJobs(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "jobs": jobs, "canEdit": canEdit})
	case http.MethodPost:
		var body struct {
			Schedule string `json:"schedule"`
			Command  string `json:"command"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddCronJob(*cfg, domain, body.Schedule, body.Command); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		var body struct {
			ID string `json:"id"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaDeleteCronJob(*cfg, domain, strings.TrimSpace(body.ID)); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainFtpRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		accounts, err := panels.HestiaListFtpAccounts(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "accounts": accounts})
	case http.MethodPost:
		var body struct {
			User string `json:"user"`
			Pass string `json:"pass"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaAddFtpAccount(*cfg, domain, body.User, body.Pass); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodPatch:
		var body struct {
			User string `json:"user"`
			Pass string `json:"pass"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaChangeFtpPassword(*cfg, domain, body.User, body.Pass); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case http.MethodDelete:
		var body struct {
			User string `json:"user"`
		}
		if err := decodeJSON(r, &body); err != nil {
			WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		if err := panels.HestiaDeleteFtpAccount(*cfg, domain, body.User); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainBackupsRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		payload, err := panels.HestiaListBackups(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"scheduled": payload.Scheduled,
			"canBackup": payload.CanBackup,
			"native":    payload.Native,
		})
	case http.MethodPost:
		file, err := panels.HestiaStartBackup(*cfg, domain)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		result := map[string]any{}
		if file != "" {
			result["file"] = file
		}
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainBackupsDownloadRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "name query required"})
		return
	}
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	filename, err := panels.HestiaResolveBackup(*cfg, domain, name)
	if err != nil {
		WriteJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := panels.StreamBackupFile(w, filename); err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
	}
}

func (h *Handler) panelDomainEnableRoute(w http.ResponseWriter, r *http.Request) {
	h.panelDomainSuspendRoute(w, r, false)
}

func (h *Handler) panelDomainDisableRoute(w http.ResponseWriter, r *http.Request) {
	h.panelDomainSuspendRoute(w, r, true)
}

func (h *Handler) panelDomainSuspendRoute(w http.ResponseWriter, r *http.Request, suspend bool) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	action := "panel.domain.enable"
	if suspend {
		action = "panel.domain.disable"
	}
	if err := h.requireConfirm(r, action, domain); err != nil {
		writeConfirmError(w, err)
		return
	}
	var err error
	if suspend {
		err = panels.HestiaSuspendDomain(*cfg, domain)
	} else {
		err = panels.HestiaUnsuspendDomain(*cfg, domain)
	}
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record(action, domain, domain, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) panelDomainHealthRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	report, err := panels.HestiaWebsiteHealth(*cfg, domain)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "report": report})
}

func (h *Handler) panelDomainWebsiteLogsRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	logType := strings.TrimSpace(r.URL.Query().Get("type"))
	if logType == "" {
		logType = "access"
	}
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	text, err := panels.HestiaWebsiteLogs(*cfg, domain, logType)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "log": text, "type": logType})
}

func (h *Handler) panelWidgetsSummaryRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	summary, err := panels.HestiaWidgetSummary(*cfg)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "summary": summary})
}

func (h *Handler) panelAppsRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	cfg, err := h.linkedPanelConfig()
	if err != nil || cfg == nil {
		WriteJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "Panel not linked"})
		return
	}
	var apps []panels.PanelApp
	switch cfg.Panel {
	case "coolify":
		apps, err = panels.CoolifyListApps(*cfg)
	case "casaOS":
		overview, oerr := panels.FetchOverview(*cfg)
		if oerr != nil {
			err = oerr
			break
		}
		for _, item := range overview.Items {
			apps = append(apps, panels.PanelApp{
				ID:     item.ID,
				Name:   item.Title,
				Status: item.Status,
				Detail: item.Detail,
			})
		}
	default:
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "Apps not supported for this panel"})
		return
	}
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "apps": apps})
}

func (h *Handler) panelAppActionRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	cfg, err := h.linkedPanelConfig()
	if err != nil || cfg == nil {
		WriteJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "Panel not linked"})
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	action := strings.TrimSpace(r.PathValue("action"))
	if id == "" || action == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "id and action required"})
		return
	}
	confirmAction := "panel.app." + action
	if err := h.requireConfirm(r, confirmAction, id); err != nil {
		writeConfirmError(w, err)
		return
	}
	if cfg.Panel != "coolify" {
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "Action not supported for this panel"})
		return
	}
	switch action {
	case "deploy":
		err = panels.CoolifyDeployApp(*cfg, id)
	case "start":
		err = panels.CoolifyStartApp(*cfg, id)
	case "stop":
		err = panels.CoolifyStopApp(*cfg, id)
	default:
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "unknown action"})
		return
	}
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record(confirmAction, id, id, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/docker"
	"github.com/macdirtycow/qadbak/agent/internal/system"
	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

const confirmHeader = "X-Qadbak-Confirm"

type confirmRequestBody struct {
	Action string `json:"action"`
	Target string `json:"target"`
}

func (h *Handler) actionsConfirm(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !h.allowRate("confirm:"+deviceID, 30, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	var body confirmRequestBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid JSON"})
		return
	}
	action := strings.TrimSpace(body.Action)
	target := strings.TrimSpace(body.Target)
	if err := validateConfirmAction(action, target); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": err.Error(), "code": "VALIDATION_FAILED"})
		return
	}
	if !h.capabilityForAction(action) {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	token, exp, err := h.store.IssueConfirmToken(h.cfg.JWTSecret, deviceID, action, target)
	if err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not issue confirmation"})
		return
	}
	h.audit.Record("confirm.issue", action+":"+target, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"confirmToken": token,
		"expiresIn":    exp,
	})
}

func (h *Handler) serviceControl(w http.ResponseWriter, r *http.Request, deviceID, verb string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["serviceManagement"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	unit := strings.TrimSpace(r.PathValue("id"))
	if !validate.ServiceUnit(unit) {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid service unit", "code": "VALIDATION_FAILED"})
		return
	}
	action := "service." + verb
	if err := h.requireConfirm(r, action, unit); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("svc:"+deviceID, 20, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	if err := system.ControlService(unit, verb); err != nil {
		h.audit.Record(action, unit, deviceID, clientIP(r), "error")
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record(action, unit, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "service": unit, "action": verb})
}

func (h *Handler) dockerControl(w http.ResponseWriter, r *http.Request, deviceID, verb string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["dockerManagement"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Docker not available", "code": "CAPABILITY_MISSING"})
		return
	}
	id := strings.TrimSpace(strings.ToLower(r.PathValue("id")))
	if !validate.ContainerID(id) {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Invalid container id", "code": "VALIDATION_FAILED"})
		return
	}
	action := "docker." + verb
	if err := h.requireConfirm(r, action, id); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("docker:"+deviceID, 20, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	if err := docker.ControlContainer(id, verb); err != nil {
		h.audit.Record(action, id, deviceID, clientIP(r), "error")
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record(action, id, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "container": id, "action": verb})
}

func (h *Handler) updatesCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["packageUpdates"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	info, err := system.CheckUpdates()
	if err != nil {
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "Could not check updates"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "updates": info})
}

func (h *Handler) updatesInstall(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["packageUpdates"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	const action = "updates.install"
	const target = "*"
	if err := h.requireConfirm(r, action, target); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("updates:"+deviceID, 3, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	if err := system.InstallUpdates(); err != nil {
		h.audit.Record(action, target, deviceID, clientIP(r), "error")
		WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record(action, target, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) systemReboot(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["reboot"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	const action = "system.reboot"
	const target = "*"
	if err := h.requireConfirm(r, action, target); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("reboot:"+deviceID, 2, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	h.audit.Record(action, target, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Reboot scheduled"})
	go func() { _ = system.Reboot() }()
}

func (h *Handler) systemShutdown(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	caps := h.capabilitiesMap()
	if !caps["shutdown"] {
		WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Capability missing", "code": "CAPABILITY_MISSING"})
		return
	}
	const action = "system.shutdown"
	const target = "*"
	if err := h.requireConfirm(r, action, target); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("shutdown:"+deviceID, 2, time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}
	h.audit.Record(action, target, deviceID, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Shutdown scheduled"})
	go func() { _ = system.Shutdown() }()
}

func (h *Handler) requireConfirm(r *http.Request, action, target string) error {
	token := strings.TrimSpace(r.Header.Get(confirmHeader))
	if token == "" {
		return errConfirmRequired
	}
	return h.store.ConsumeConfirmToken(h.cfg.JWTSecret, token, action, target)
}

var errConfirmRequired = errors.New("confirmation required")

func writeConfirmError(w http.ResponseWriter, err error) {
	if errors.Is(err, errConfirmRequired) {
		WriteJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "Confirmation required", "code": "CONFIRMATION_REQUIRED"})
		return
	}
	WriteJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "Invalid confirmation", "code": "CONFIRMATION_INVALID"})
}

func validateConfirmAction(action, target string) error {
	switch action {
	case "service.start", "service.stop", "service.restart":
		if !validate.ServiceUnit(target) {
			return errors.New("invalid service unit")
		}
	case "docker.start", "docker.stop", "docker.restart":
		if !validate.ContainerID(strings.ToLower(target)) {
			return errors.New("invalid container id")
		}
	case "updates.install", "system.reboot", "system.shutdown":
		if target != "" && target != "*" {
			return errors.New("invalid target")
		}
	case "agent.upgrade":
		if target == "" {
			return errors.New("invalid target")
		}
	case "panel.domain.create":
		if target != "" && target != "*" {
			return errors.New("invalid target")
		}
	case "panel.domain.delete":
		if target == "" {
			return errors.New("invalid target")
		}
	case "panel.domain.enable", "panel.domain.disable":
		if target == "" {
			return errors.New("invalid target")
		}
	case "panel.app.deploy", "panel.app.start", "panel.app.stop":
		if target == "" {
			return errors.New("invalid target")
		}
	default:
		return errors.New("unknown action")
	}
	return nil
}

func (h *Handler) capabilityForAction(action string) bool {
	caps := h.capabilitiesMap()
	switch {
	case strings.HasPrefix(action, "service."):
		return caps["serviceManagement"]
	case strings.HasPrefix(action, "docker."):
		return caps["dockerManagement"]
	case action == "updates.install":
		return caps["packageUpdates"]
	case action == "agent.upgrade":
		return caps["agentSelfUpgrade"]
	case action == "system.reboot":
		return caps["reboot"]
	case action == "system.shutdown":
		return caps["shutdown"]
	case strings.HasPrefix(action, "panel.domain."):
		return caps["domainHosting"]
	case strings.HasPrefix(action, "panel.app."):
		return caps["panelApps"]
	default:
		return false
	}
}

func clientIP(r *http.Request) string {
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i > 0 {
		return host[:i]
	}
	return host
}

package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/panels"
)

func (h *Handler) panelDomainFilesRoute(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSpace(r.PathValue("domain"))
	switch r.Method {
	case http.MethodGet:
		h.panelDomainFilesList(w, r, domain)
	case http.MethodPost:
		h.panelDomainFilesMutate(w, r, domain)
	case http.MethodDelete:
		h.panelDomainFilesDelete(w, r, domain)
	default:
		methodNotAllowed(w)
	}
}

func (h *Handler) panelDomainFilesList(w http.ResponseWriter, r *http.Request, domain string) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	dir := strings.TrimSpace(r.URL.Query().Get("dir"))
	listing, err := panels.HestiaListFiles(*cfg, domain, dir)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, listing)
}

func (h *Handler) panelDomainFilesContentRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	panelPath := strings.TrimSpace(r.URL.Query().Get("path"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	content, err := panels.HestiaReadFile(*cfg, domain, panelPath)
	if err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	WriteJSON(w, http.StatusOK, content)
}

type panelFilesActionBody struct {
	Action   string `json:"action"`
	Path     string `json:"path"`
	Parent   string `json:"parent"`
	Name     string `json:"name"`
	Content  string `json:"content"`
	DestDir  string `json:"destDir"`
	NewName  string `json:"newName"`
	Overwrite bool  `json:"overwrite"`
}

func (h *Handler) panelDomainFilesMutate(w http.ResponseWriter, r *http.Request, domain string) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	var body panelFilesActionBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "invalid JSON"})
		return
	}
	action := strings.TrimSpace(body.Action)
	switch action {
	case "mkdir":
		path, err := panels.HestiaMkdir(*cfg, domain, body.Parent, body.Name)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		h.audit.Record("panel.files.mkdir", domain, path, clientIP(r), "ok")
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "path": path})
	case "create-file":
		path, err := panels.HestiaCreateFile(*cfg, domain, body.Parent, body.Name, body.Content)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		h.audit.Record("panel.files.create", domain, path, clientIP(r), "ok")
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "path": path})
	case "save":
		if err := panels.HestiaWriteFile(*cfg, domain, body.Path, body.Content); err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		h.audit.Record("panel.files.save", domain, body.Path, clientIP(r), "ok")
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
	case "move":
		path, err := panels.HestiaMoveFile(*cfg, domain, body.Path, body.DestDir, body.NewName, body.Overwrite)
		if err != nil {
			WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		h.audit.Record("panel.files.move", domain, path, clientIP(r), "ok")
		WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "path": path})
	default:
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "unknown action"})
	}
}

type panelFilesDeleteBody struct {
	Path string `json:"path"`
}

func (h *Handler) panelDomainFilesDelete(w http.ResponseWriter, r *http.Request, domain string) {
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	var body panelFilesDeleteBody
	if err := decodeJSON(r, &body); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "invalid JSON"})
		return
	}
	if err := panels.HestiaDeleteFile(*cfg, domain, body.Path); err != nil {
		WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	h.audit.Record("panel.files.delete", domain, body.Path, clientIP(r), "ok")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) panelDomainFilesUploadRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	domain := strings.TrimSpace(r.PathValue("domain"))
	cfg, ok := h.requireHestiaLink(w)
	if !ok {
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "invalid upload"})
		return
	}
	dir := strings.TrimSpace(r.FormValue("dir"))
	overwrite := strings.EqualFold(strings.TrimSpace(r.FormValue("overwrite")), "true")
	uploaded := make([]string, 0)
	for _, headers := range r.MultipartForm.File {
		for _, header := range headers {
			file, err := header.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(io.LimitReader(file, 100<<20))
			file.Close()
			if err != nil {
				continue
			}
			path, err := panels.HestiaUploadFile(*cfg, domain, dir, header.Filename, data, overwrite)
			if err != nil {
				WriteJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			uploaded = append(uploaded, path)
			h.audit.Record("panel.files.upload", domain, path, clientIP(r), "ok")
		}
	}
	if len(uploaded) == 0 {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "no files uploaded"})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "uploaded": uploaded})
}

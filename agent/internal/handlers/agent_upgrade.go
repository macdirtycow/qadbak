package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

const (
	agentUpgradeMaxBytes = 32 << 20
	agentStagingName     = "qadbak-agent-staging"
)

func (h *Handler) agentUpgradeRoute(w http.ResponseWriter, r *http.Request, deviceID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	version := strings.TrimSpace(r.Header.Get("X-Agent-Version"))
	shaExpected := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Agent-SHA256")))
	if version == "" || shaExpected == "" {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "X-Agent-Version and X-Agent-SHA256 required"})
		return
	}
	if len(shaExpected) != 64 {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "invalid sha256"})
		return
	}
	const action = "agent.upgrade"
	if err := h.requireConfirm(r, action, version); err != nil {
		writeConfirmError(w, err)
		return
	}
	if !h.allowRate("agent-upgrade:"+deviceID, 2, 10*time.Minute) {
		WriteJSON(w, http.StatusTooManyRequests, map[string]any{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED"})
		return
	}

	stagingDir := filepath.Join(h.cfg.DataDir, "upgrade")
	if err := os.MkdirAll(stagingDir, 0o750); err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not prepare upgrade"})
		return
	}
	stagingPath := filepath.Join(stagingDir, agentStagingName)

	limited := io.LimitReader(r.Body, agentUpgradeMaxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		WriteJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "Could not read upgrade body"})
		return
	}
	if len(data) == 0 {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Empty upgrade body"})
		return
	}
	if len(data) > agentUpgradeMaxBytes {
		WriteJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"ok": false, "error": "Upgrade binary too large"})
		return
	}
	sum := sha256.Sum256(data)
	actual := hex.EncodeToString(sum[:])
	if actual != shaExpected {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Checksum mismatch"})
		return
	}
	if len(data) >= 4 && !(data[0] == 0x7f && data[1] == 'E' && data[2] == 'L' && data[3] == 'F') {
		WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": "Not a Linux ELF binary"})
		return
	}
	if err := os.WriteFile(stagingPath, data, 0o750); err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "Could not stage upgrade"})
		return
	}

	h.audit.Record(action, version, deviceID, clientIP(r), "staged")
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "version": version, "message": "Upgrade staged; agent will restart"})

	go func() {
		if err := privilege.RunSimple([]string{"agent-upgrade", stagingPath}); err != nil {
			h.audit.Record(action, version, deviceID, "local", "error:"+err.Error())
			return
		}
		h.audit.Record(action, version, deviceID, "local", "ok")
	}()
}

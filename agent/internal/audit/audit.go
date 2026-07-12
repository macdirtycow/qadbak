package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Entry struct {
	Timestamp time.Time `json:"ts"`
	Action    string    `json:"action"`
	Target    string    `json:"target,omitempty"`
	DeviceID  string    `json:"deviceId,omitempty"`
	SourceIP  string    `json:"sourceIp,omitempty"`
	Result    string    `json:"result"`
}

type Logger struct {
	path string
	mu   sync.Mutex
}

func NewLogger(dataDir string) (*Logger, error) {
	logDir := filepath.Join(dataDir, "logs")
	if err := os.MkdirAll(logDir, 0o750); err != nil {
		return nil, err
	}
	return &Logger{path: filepath.Join(logDir, "audit.log")}, nil
}

func (l *Logger) Record(action, target, deviceID, sourceIP, result string) {
	if l == nil {
		return
	}
	entry := Entry{
		Timestamp: time.Now().UTC(),
		Action:    action,
		Target:    target,
		DeviceID:  deviceID,
		SourceIP:  sourceIP,
		Result:    result,
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	f, err := os.OpenFile(l.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o640)
	if err != nil {
		return
	}
	defer f.Close()
	b, _ := json.Marshal(entry)
	_, _ = f.Write(append(b, '\n'))
}

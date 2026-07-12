package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
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

// Tail returns the last n audit entries (newest last).
func (l *Logger) Tail(n int) ([]Entry, error) {
	if l == nil {
		return []Entry{}, nil
	}
	if n <= 0 || n > 500 {
		n = 200
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	b, err := os.ReadFile(l.path)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, nil
		}
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) == 0 {
		return []Entry{}, nil
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	entries := make([]Entry, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var e Entry
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

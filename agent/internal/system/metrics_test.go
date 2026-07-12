package system_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/system"
)

func TestMetricsHistoryRingBuffer(t *testing.T) {
	dir := t.TempDir()
	h := system.NewMetricsHistory(dir)
	overview := system.Overview{CPUPercent: 12.5, MemoryUsedBytes: 100, MemoryTotalBytes: 200}
	if err := h.RecordFromOverview(overview); err != nil {
		t.Fatal(err)
	}
	samples, err := h.List(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(samples) != 1 {
		t.Fatalf("expected 1 sample, got %d", len(samples))
	}
	if _, err := os.Stat(filepath.Join(dir, "metrics-history.json")); err != nil {
		t.Fatalf("expected metrics file: %v", err)
	}
}

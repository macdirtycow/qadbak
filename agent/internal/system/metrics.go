package system

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxMetricSamples = 60

type MetricSample struct {
	Timestamp        time.Time `json:"timestamp"`
	CPUPercent       float64   `json:"cpuPercent"`
	MemoryUsedBytes  int64     `json:"memoryUsedBytes"`
	MemoryTotalBytes int64     `json:"memoryTotalBytes"`
	DiskUsedBytes    int64     `json:"diskUsedBytes"`
	DiskTotalBytes   int64     `json:"diskTotalBytes"`
	LoadAverage      []float64 `json:"loadAverage,omitempty"`
}

type MetricsHistory struct {
	path string
	mu   sync.Mutex
}

func NewMetricsHistory(dataDir string) *MetricsHistory {
	return &MetricsHistory{path: filepath.Join(dataDir, "metrics-history.json")}
}

func (h *MetricsHistory) RecordFromOverview(overview Overview) error {
	sample := MetricSample{
		Timestamp:        time.Now().UTC(),
		CPUPercent:       overview.CPUPercent,
		MemoryUsedBytes:  overview.MemoryUsedBytes,
		MemoryTotalBytes: overview.MemoryTotalBytes,
		DiskUsedBytes:    overview.DiskUsedBytes,
		DiskTotalBytes:   overview.DiskTotalBytes,
		LoadAverage:      overview.LoadAverage,
	}
	return h.append(sample)
}

func (h *MetricsHistory) List(limit int) ([]MetricSample, error) {
	if limit <= 0 || limit > maxMetricSamples {
		limit = maxMetricSamples
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	samples, err := h.loadLocked()
	if err != nil {
		return nil, err
	}
	if len(samples) > limit {
		samples = samples[len(samples)-limit:]
	}
	return samples, nil
}

func (h *MetricsHistory) append(sample MetricSample) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	samples, err := h.loadLocked()
	if err != nil {
		return err
	}
	samples = append(samples, sample)
	if len(samples) > maxMetricSamples {
		samples = samples[len(samples)-maxMetricSamples:]
	}
	return h.saveLocked(samples)
}

func (h *MetricsHistory) loadLocked() ([]MetricSample, error) {
	b, err := os.ReadFile(h.path)
	if err != nil {
		if os.IsNotExist(err) {
			return []MetricSample{}, nil
		}
		return nil, err
	}
	var samples []MetricSample
	if err := json.Unmarshal(b, &samples); err != nil {
		return []MetricSample{}, nil
	}
	return samples, nil
}

func (h *MetricsHistory) saveLocked(samples []MetricSample) error {
	if err := os.MkdirAll(filepath.Dir(h.path), 0o750); err != nil {
		return err
	}
	b, err := json.MarshalIndent(samples, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.path, b, 0o640)
}

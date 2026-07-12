package system

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Overview struct {
	Online          bool     `json:"online"`
	UptimeSeconds   int64    `json:"uptimeSeconds"`
	OperatingSystem string   `json:"operatingSystem"`
	Architecture    string   `json:"architecture"`
	Hostname        string   `json:"hostname"`
	AgentVersion    string   `json:"agentVersion"`
	LoadAverage     []float64 `json:"loadAverage"`
	CPUPercent      float64  `json:"cpuPercent"`
	MemoryUsedBytes int64    `json:"memoryUsedBytes"`
	MemoryTotalBytes int64   `json:"memoryTotalBytes"`
	DiskUsedBytes   int64    `json:"diskUsedBytes"`
	DiskTotalBytes  int64    `json:"diskTotalBytes"`
	LastBoot        string   `json:"lastBoot,omitempty"`
}

func CollectOverview(agentVersion string) Overview {
	host, _ := os.Hostname()
	osName := readOSRelease()
	load := readLoadAvg()
	memUsed, memTotal := readMemInfo()
	diskUsed, diskTotal := readDisk("/")
	uptime := readUptime()

	return Overview{
		Online:           true,
		UptimeSeconds:    uptime,
		OperatingSystem:  osName,
		Architecture:     runtime.GOARCH,
		Hostname:         host,
		AgentVersion:     agentVersion,
		LoadAverage:      load,
		CPUPercent:       readCPUPercent(),
		MemoryUsedBytes:  memUsed,
		MemoryTotalBytes: memTotal,
		DiskUsedBytes:    diskUsed,
		DiskTotalBytes:   diskTotal,
	}
}

func readOSRelease() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return runtime.GOOS
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	pretty := ""
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			pretty = strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
		}
	}
	if pretty != "" {
		return pretty
	}
	return runtime.GOOS
}

func readLoadAvg() []float64 {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return nil
	}
	parts := strings.Fields(string(b))
	out := make([]float64, 0, 3)
	for i := 0; i < len(parts) && i < 3; i++ {
		if v, err := strconv.ParseFloat(parts[i], 64); err == nil {
			out = append(out, v)
		}
	}
	return out
}

func readMemInfo() (used, total int64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	var memTotal, memAvail int64
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			memTotal = parseKB(line)
		}
		if strings.HasPrefix(line, "MemAvailable:") {
			memAvail = parseKB(line)
		}
	}
	if memTotal == 0 {
		return 0, 0
	}
	used = (memTotal - memAvail) * 1024
	total = memTotal * 1024
	return used, total
}

func parseKB(line string) int64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}
	v, _ := strconv.ParseInt(fields[1], 10, 64)
	return v
}

func readDisk(path string) (used, total int64) {
	out, err := exec.Command("df", "-B1", "--output=used,size", path).Output()
	if err != nil {
		return 0, 0
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return 0, 0
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 2 {
		return 0, 0
	}
	u, _ := strconv.ParseInt(fields[0], 10, 64)
	t, _ := strconv.ParseInt(fields[1], 10, 64)
	return u, t
}

func readUptime() int64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	sec, _ := strconv.ParseFloat(fields[0], 64)
	return int64(sec)
}

func readCPUPercent() float64 {
	idle1, total1 := readCPUStat()
	time.Sleep(200 * time.Millisecond)
	idle2, total2 := readCPUStat()
	if total2 <= total1 {
		return 0
	}
	idleDelta := float64(idle2 - idle1)
	totalDelta := float64(total2 - total1)
	return (1.0 - idleDelta/totalDelta) * 100
}

func readCPUStat() (idle, total uint64) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	line := strings.Split(string(b), "\n")[0]
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, 0
	}
	var nums []uint64
	for _, f := range fields[1:] {
		v, err := strconv.ParseUint(f, 10, 64)
		if err != nil {
			continue
		}
		nums = append(nums, v)
	}
	for _, v := range nums {
		total += v
	}
	if len(nums) >= 4 {
		idle = nums[3]
	}
	return idle, total
}

func ValidateSupportedOS() error {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return fmt.Errorf("unsupported: cannot read os-release")
	}
	defer f.Close()
	id, versionID := "", ""
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "ID=") {
			id = strings.Trim(strings.TrimPrefix(line, "ID="), "\"")
		}
		if strings.HasPrefix(line, "VERSION_ID=") {
			versionID = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), "\"")
		}
	}
	switch id {
	case "debian":
		if versionID == "12" {
			return nil
		}
	case "ubuntu":
		if versionID == "22.04" || versionID == "24.04" {
			return nil
		}
	}
	return fmt.Errorf("unsupported OS: %s %s (beta supports Debian 12, Ubuntu 22.04/24.04)", id, versionID)
}

package panels

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

const hestiaInstallPath = "/usr/local/hestia"

// HestiaSetupInfo is returned to the iOS app before linking HestiaCP.
type HestiaSetupInfo struct {
	Detected       bool   `json:"detected"`
	DefaultBaseURL string `json:"defaultBaseUrl"`
	CanAutoSetup   bool   `json:"canAutoSetup"`
	RecommendedAuth string `json:"recommendedAuth,omitempty"`
}

// HestiaBootstrapResult contains a freshly generated API key pair (shown once).
type HestiaBootstrapResult struct {
	BaseURL   string `json:"baseUrl"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Comment   string `json:"comment,omitempty"`
}

func HestiaInstalled() bool {
	_, err := os.Stat(hestiaInstallPath)
	return err == nil
}

func BuildHestiaSetupInfo() HestiaSetupInfo {
	installed := HestiaInstalled()
	return HestiaSetupInfo{
		Detected:        installed,
		DefaultBaseURL:  defaultHestiaBase(),
		CanAutoSetup:    installed,
		RecommendedAuth: "accessKey",
	}
}

// HestiaEnsureLoopbackAPI whitelists 127.0.0.1 for the Hestia API (idempotent).
func HestiaEnsureLoopbackAPI() error {
	if !HestiaInstalled() {
		return fmt.Errorf("hestia is not installed")
	}
	_, err := privilege.Run([]string{"hestia-cmd", "add-api-ip", "127.0.0.1"})
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "exists") || strings.Contains(msg, "already") {
		return nil
	}
	return err
}

// HestiaBootstrap creates a Hestia API access key via the local CLI (agent runs on the same host).
func HestiaBootstrap() (HestiaBootstrapResult, error) {
	if !HestiaInstalled() {
		return HestiaBootstrapResult{}, fmt.Errorf("hestia is not installed on this server")
	}
	if err := HestiaEnsureLoopbackAPI(); err != nil {
		return HestiaBootstrapResult{}, fmt.Errorf("could not allow loopback API access: %w", err)
	}

	out, err := privilege.Run([]string{"hestia-cmd", "access-key", "qadbak-mobile"})
	if err != nil {
		return HestiaBootstrapResult{}, fmt.Errorf("could not create hestia access key: %w", err)
	}

	accessKey, secretKey, err := parseHestiaAccessKeyJSON(out)
	if err != nil {
		return HestiaBootstrapResult{}, err
	}
	return HestiaBootstrapResult{
		BaseURL:   defaultHestiaBase(),
		AccessKey: accessKey,
		SecretKey: secretKey,
		Comment:   "qadbak-mobile",
	}, nil
}

func parseHestiaAccessKeyJSON(out []byte) (accessKey, secretKey string, err error) {
	text := strings.TrimSpace(string(out))
	// v-add-access-key may print log lines before JSON; take the last JSON object.
	start := strings.LastIndex(text, "{")
	end := strings.LastIndex(text, "}")
	if start < 0 || end <= start {
		return "", "", fmt.Errorf("hestia access key: unexpected CLI output")
	}
	var payload struct {
		AccessKeyID     string `json:"ACCESS_KEY_ID"`
		SecretAccessKey string `json:"SECRET_ACCESS_KEY"`
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), &payload); err != nil {
		return "", "", fmt.Errorf("hestia access key: parse JSON: %w", err)
	}
	accessKey = strings.TrimSpace(payload.AccessKeyID)
	secretKey = strings.TrimSpace(payload.SecretAccessKey)
	if accessKey == "" || secretKey == "" {
		return "", "", fmt.Errorf("hestia access key: missing key material in CLI output")
	}
	return accessKey, secretKey, nil
}

// NormalizeHestiaBaseURL fills the default panel URL when empty.
func NormalizeHestiaBaseURL(base string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return defaultHestiaBase()
	}
	return base
}

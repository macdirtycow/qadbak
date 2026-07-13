package panels

import (
	"strings"
	"testing"
)

func TestParseHestiaAccessKeyJSON(t *testing.T) {
	raw := `OK
{
 "ACCESS_KEY_ID": "abcd1234567890123456",
 "SECRET_ACCESS_KEY": "ef0123456789abcdef0123456789abcdef0123456",
 "USER": "admin"
}`
	access, secret, err := parseHestiaAccessKeyJSON([]byte(raw))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if access != "abcd1234567890123456" {
		t.Fatalf("access=%q", access)
	}
	if !strings.HasPrefix(secret, "ef01") {
		t.Fatalf("secret=%q", secret)
	}
}

func TestNormalizeHestiaBaseURL(t *testing.T) {
	if got := NormalizeHestiaBaseURL(""); got != defaultHestiaBase() {
		t.Fatalf("empty base: %q", got)
	}
	if got := NormalizeHestiaBaseURL("https://10.0.0.1:8083"); got != "https://10.0.0.1:8083" {
		t.Fatalf("custom base: %q", got)
	}
}

func TestHestiaSetupInfo(t *testing.T) {
	info := BuildHestiaSetupInfo()
	if info.DefaultBaseURL != defaultHestiaBase() {
		t.Fatalf("default url: %q", info.DefaultBaseURL)
	}
	if info.RecommendedAuth != "accessKey" {
		t.Fatalf("recommended auth: %q", info.RecommendedAuth)
	}
}

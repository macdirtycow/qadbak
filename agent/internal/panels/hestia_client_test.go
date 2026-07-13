package panels

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestHestiaClientAccessKeyAuth(t *testing.T) {
	var got url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		got = r.PostForm
		w.Header().Set("Hestia-Exit-Code", "0")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = io.WriteString(w, `{"admin":{}}`)
	}))
	defer srv.Close()

	c := testHestiaClient(srv, hestiaAuth{
		mode:      hestiaAuthAccessKey,
		accessKey: "abcd1234567890123456",
		secretKey: "ef0123456789abcdef0123456789abcdef0123456",
	})
	body, err := c.exec("v-list-users", "json")
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	if !strings.Contains(string(body), "admin") {
		t.Fatalf("unexpected body: %s", body)
	}
	if got.Get("access_key") != "abcd1234567890123456" {
		t.Fatalf("access_key=%q", got.Get("access_key"))
	}
	if got.Get("secret_key") == "" {
		t.Fatal("secret_key missing")
	}
	if got.Get("user") != "" || got.Get("password") != "" {
		t.Fatalf("legacy fields should be empty, got user=%q password set=%v", got.Get("user"), got.Get("password") != "")
	}
	if got.Get("returncode") != "" {
		t.Fatalf("returncode should not be sent, got %q", got.Get("returncode"))
	}
	if got.Get("cmd") != "v-list-users" || got.Get("arg1") != "json" {
		t.Fatalf("cmd/args: cmd=%q arg1=%q", got.Get("cmd"), got.Get("arg1"))
	}
}

func TestHestiaClientLegacyUserAuth(t *testing.T) {
	var got url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		got = r.PostForm
		_, _ = io.WriteString(w, "OK")
	}))
	defer srv.Close()

	c := testHestiaClient(srv, hestiaAuth{
		mode:     hestiaAuthLegacyUser,
		user:     "admin",
		password: "secret",
	})
	if _, err := c.exec("v-list-sys-info"); err != nil {
		t.Fatalf("exec: %v", err)
	}
	if got.Get("user") != "admin" || got.Get("password") != "secret" {
		t.Fatalf("legacy auth fields wrong: user=%q password=%q", got.Get("user"), got.Get("password"))
	}
	if got.Get("access_key") != "" || got.Get("secret_key") != "" {
		t.Fatal("access key fields should be empty for legacy auth")
	}
}

func TestHestiaClientExitCodeError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Hestia-Exit-Code", "3")
		http.Error(w, "Error: object not found", http.StatusNotFound)
	}))
	defer srv.Close()

	c := testHestiaClient(srv, hestiaAuth{mode: hestiaAuthAccessKey, accessKey: "a", secretKey: "b"})
	_, err := c.exec("v-list-web-domains", "admin", "json")
	if err == nil || !strings.Contains(err.Error(), "exit 3") {
		t.Fatalf("expected exit 3 error, got %v", err)
	}
}

func TestHestiaClientNoContentSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Hestia-Exit-Code", "0")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	c := testHestiaClient(srv, hestiaAuth{mode: hestiaAuthAccessKey, accessKey: "a", secretKey: "b"})
	body, err := c.exec("v-add-letsencrypt-domain", "admin", "example.com")
	if err != nil {
		t.Fatalf("exec: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("expected empty body, got %q", body)
	}
}

func TestNewHestiaClientRequiresCredentials(t *testing.T) {
	_, err := newHestiaClient(LinkConfig{Panel: "hestiaCP"})
	if err == nil {
		t.Fatal("expected error for missing credentials")
	}
}

func TestNewHestiaClientPrefersAccessKey(t *testing.T) {
	c, err := newHestiaClient(LinkConfig{
		Panel: "hestiaCP",
		Secrets: map[string]string{
			"accessKey": "key",
			"secretKey": "secret",
			"username":  "admin",
			"password":  "pass",
		},
	})
	if err != nil {
		t.Fatalf("newHestiaClient: %v", err)
	}
	if c.auth.mode != hestiaAuthAccessKey {
		t.Fatalf("expected access key mode, got %v", c.auth.mode)
	}
}

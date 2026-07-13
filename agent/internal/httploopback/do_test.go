package httploopback

import (
	"net/http"
	"testing"
)

func TestDoRejectsNonLoopbackHost(t *testing.T) {
	client := Client("http", 80)
	req, err := http.NewRequest(http.MethodGet, "http://example.com/api/", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Do(client, req); err == nil {
		t.Fatal("expected non-loopback host to fail")
	}
}

func TestDoAllowsLoopbackHost(t *testing.T) {
	client := Client("http", 1)
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Do(client, req)
	if err == nil {
		return
	}
	// Dial may fail without a listener; host validation must pass first.
	if err.Error() == "loopback host not allowed" {
		t.Fatalf("unexpected host rejection: %v", err)
	}
}

package auth_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/auth"
)

func TestConfirmTokenSingleUse(t *testing.T) {
	dir := t.TempDir()
	store, err := auth.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	secret := []byte("confirm-secret")
	token, _, err := store.IssueConfirmToken(secret, "device-1", "service.restart", "nginx.service")
	if err != nil || token == "" {
		t.Fatalf("issue: %v", err)
	}
	if err := store.ConsumeConfirmToken(secret, token, "service.restart", "nginx.service"); err != nil {
		t.Fatalf("consume: %v", err)
	}
	if err := store.ConsumeConfirmToken(secret, token, "service.restart", "nginx.service"); err == nil {
		t.Fatal("expected reuse to fail")
	}
}

func TestConfirmTokenActionMismatch(t *testing.T) {
	dir := t.TempDir()
	store, err := auth.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	secret := []byte("confirm-secret")
	token, _, err := store.IssueConfirmToken(secret, "device-1", "service.restart", "nginx.service")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.ConsumeConfirmToken(secret, token, "service.stop", "nginx.service"); err == nil {
		t.Fatal("expected action mismatch")
	}
}

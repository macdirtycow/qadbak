package auth_test

import (
	"testing"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/auth"
)

func TestPairingAndSession(t *testing.T) {
	dir := t.TempDir()
	store, err := auth.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	token, err := store.IssuePairingToken()
	if err != nil || token == "" {
		t.Fatalf("pairing token: %v", err)
	}
	if err := store.ConsumePairingToken(token); err != nil {
		t.Fatalf("consume pairing: %v", err)
	}
	if err := store.ConsumePairingToken(token); err == nil {
		t.Fatal("expected pairing token reuse to fail")
	}

	secret := []byte("test-secret")
	access, refresh, exp, err := store.CreateSession(secret, "device-1", "test")
	if err != nil || access == "" || refresh == "" || exp <= 0 {
		t.Fatalf("session: access=%q refresh=%q exp=%d err=%v", access, refresh, exp, err)
	}
	device, err := store.ValidateAccess(secret, access)
	if err != nil || device != "device-1" {
		t.Fatalf("validate access: device=%q err=%v", device, err)
	}
	newAccess, newRefresh, _, err := store.Rotate(secret, refresh)
	if err != nil || newAccess == "" || newRefresh == "" {
		t.Fatalf("rotate: %v", err)
	}
	if _, _, _, err := store.Rotate(secret, refresh); err == nil {
		t.Fatal("old refresh should be invalid after rotation")
	}
	_ = time.Now()
}

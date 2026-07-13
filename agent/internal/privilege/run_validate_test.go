package privilege

import "testing"

func TestValidatePrivArgvRejectsUnknown(t *testing.T) {
	if err := validatePrivArgv([]string{"rm", "-rf", "/"}); err == nil {
		t.Fatal("expected reject unknown priv action")
	}
}

func TestValidatePrivArgvAllowsHestiaLoopback(t *testing.T) {
	if err := validatePrivArgv([]string{"hestia-cmd", "add-api-ip", "127.0.0.1"}); err != nil {
		t.Fatalf("expected allow hestia loopback: %v", err)
	}
}

func TestValidatePrivArgvRejectsBadLogPath(t *testing.T) {
	if err := validatePrivArgv([]string{"log-tail", "/etc/passwd", "10"}); err == nil {
		t.Fatal("expected reject non-log path")
	}
}

func TestValidateRootArgvRejectsUnknownBinary(t *testing.T) {
	if err := validateRootArgv([]string{"bash", "-c", "id"}); err == nil {
		t.Fatal("expected reject unknown binary")
	}
}

package validate_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func TestServiceUnit(t *testing.T) {
	if !validate.ServiceUnit("nginx.service") {
		t.Fatal("expected valid service")
	}
	if validate.ServiceUnit("nginx; rm -rf") {
		t.Fatal("expected invalid service")
	}
}

func TestContainerID(t *testing.T) {
	if !validate.ContainerID("a1b2c3d4e5f6") {
		t.Fatal("expected valid container id")
	}
	if validate.ContainerID("not-a-container") {
		t.Fatal("expected invalid container id")
	}
}

func TestHomeAbsPath(t *testing.T) {
	_, err := validate.HomeAbsPath("/etc/passwd")
	if err == nil {
		t.Fatal("expected reject outside /home")
	}
}

func TestUpgradeStagingPath(t *testing.T) {
	ok := "/var/lib/qadbak-agent/upgrade/qadbak-agent-staging"
	got, err := validate.UpgradeStagingPath(ok)
	if err != nil {
		t.Fatalf("expected valid staging path: %v", err)
	}
	if got != ok {
		t.Fatalf("got %q", got)
	}
	_, err = validate.UpgradeStagingPath("/etc/passwd")
	if err == nil {
		t.Fatal("expected reject outside staging dir")
	}
	_, err = validate.UpgradeStagingPath("/var/lib/qadbak-agent/upgrade/../etc/passwd")
	if err == nil {
		t.Fatal("expected reject traversal")
	}
}

func TestBackupFilename(t *testing.T) {
	if !validate.BackupFilename("user.2026-01-01_12-00-00.tar") {
		t.Fatal("expected valid backup filename")
	}
	if validate.BackupFilename("../etc/passwd") {
		t.Fatal("expected invalid backup filename")
	}
	base, err := validate.NormalizeBackupFilename("/backup/user.2026-01-01_12-00-00.tar")
	if err != nil || base != "user.2026-01-01_12-00-00.tar" {
		t.Fatalf("normalize backup filename: %q err=%v", base, err)
	}
	path, err := validate.BackupAbsPath(base)
	if err != nil || path != validate.BackupDir+"/"+base {
		t.Fatalf("backup abs path: %q err=%v", path, err)
	}
}

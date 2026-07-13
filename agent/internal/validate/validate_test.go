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

package privilege

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func TestHomeAbsPathRejectsOutsideHome(t *testing.T) {
	_, err := validate.HomeAbsPath("/etc/passwd")
	if err == nil {
		t.Fatal("expected reject outside /home")
	}
}

func TestDomainFSListRejectsOutsideHome(t *testing.T) {
	root := t.TempDir()
	_, err := domainFSList(root)
	if err == nil {
		t.Fatal("expected reject outside /home")
	}
}

func TestIsTextFileName(t *testing.T) {
	if !IsTextFileName("index.html") {
		t.Fatal("html should be text")
	}
	if IsTextFileName("image.bin") {
		t.Fatal("bin should not be text")
	}
}

func TestSafeBaseName(t *testing.T) {
	if validate.SafeBaseName("../a") != "" {
		t.Fatal("reject traversal name")
	}
}

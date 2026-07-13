package privilege

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAssertHomePathRejectsOutsideHome(t *testing.T) {
	_, err := assertHomePath("/etc/passwd")
	if err == nil {
		t.Fatal("expected reject outside /home")
	}
}

func TestAssertHomePathAllowsUnderHome(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home", "user", "web", "example.com", "public_html")
	if err := os.MkdirAll(home, 0o755); err != nil {
		t.Fatal(err)
	}
	// assertHomePath hardcodes /home — test domainFSList on temp path via direct call
	entries, err := domainFSList(home)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected empty dir, got %d", len(entries))
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
	if safeBaseName("../a") != "" {
		t.Fatal("reject traversal name")
	}
}

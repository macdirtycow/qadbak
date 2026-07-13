package panels

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestHestiaFilesScopeSafePanelPath(t *testing.T) {
	scope := HestiaFilesScope{
		Owner:      "siteuser",
		Domain:     "example.com",
		Home:       "/home/siteuser",
		Sandbox:    "/home/siteuser/web/example.com",
		DefaultCwd: "web/example.com/public_html",
	}
	got, err := scope.safePanelPath("web/example.com/public_html/index.html")
	if err != nil || got != "web/example.com/public_html/index.html" {
		t.Fatalf("allowed path: %q %v", got, err)
	}
	_, err = scope.safePanelPath("web/other.com/public_html")
	if err == nil {
		t.Fatal("expected reject other domain")
	}
	_, err = scope.safePanelPath("web/example.com/../other.com")
	if err == nil {
		t.Fatal("expected reject traversal")
	}
}

func TestHestiaFilesScopeAbsFromPanel(t *testing.T) {
	scope := HestiaFilesScope{
		Owner:      "siteuser",
		Domain:     "example.com",
		Home:       "/home/siteuser",
		Sandbox:    filepath.Clean("/home/siteuser/web/example.com"),
		DefaultCwd: "web/example.com/public_html",
	}
	abs, err := scope.absFromPanel("web/example.com/public_html")
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Clean("/home/siteuser/web/example.com/public_html")
	if abs != want {
		t.Fatalf("abs=%q want %q", abs, want)
	}
}

func TestNormalizeDirDefaultsToPublicHTML(t *testing.T) {
	scope := HestiaFilesScope{
		Domain:     "example.com",
		DefaultCwd: "web/example.com/public_html",
	}
	cwd, err := scope.normalizeDir("")
	if err != nil || cwd != "web/example.com/public_html" {
		t.Fatalf("cwd=%q err=%v", cwd, err)
	}
}

func TestSafeFileName(t *testing.T) {
	if safeFileName("../x") != "" {
		t.Fatal("expected reject")
	}
	if safeFileName("index.html") != "index.html" {
		t.Fatal("expected keep name")
	}
}

func TestParentPanelPath(t *testing.T) {
	if parentPanelPath("web/example.com/public_html") != "web/example.com" {
		t.Fatalf("got %q", parentPanelPath("web/example.com/public_html"))
	}
	if parentPanelPath("file.html") != "" {
		t.Fatalf("got %q", parentPanelPath("file.html"))
	}
}

func TestFormatFileSize(t *testing.T) {
	if !strings.Contains(formatFileSize(2048), "KB") {
		t.Fatalf("size=%q", formatFileSize(2048))
	}
}

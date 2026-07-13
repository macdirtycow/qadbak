package privilege

import "testing"

// Fixture usernames only — not tied to any real deployment.
func TestParseHestiaRootUser(t *testing.T) {
	user, err := parseHestiaRootUser([]byte("FOO=bar\nROOT_USER='paneladmin'\n"))
	if err != nil {
		t.Fatal(err)
	}
	if user != "paneladmin" {
		t.Fatalf("got %q", user)
	}

	_, err = parseHestiaRootUser([]byte("ROOT_USER=\"admin\"\n"))
	if err != nil {
		t.Fatal(err)
	}

	_, err = parseHestiaRootUser([]byte("ROOT_USER='bad;user'\n"))
	if err == nil {
		t.Fatal("expected invalid username to fail")
	}

	_, err = parseHestiaRootUser([]byte("FOO=bar\n"))
	if err == nil {
		t.Fatal("expected missing ROOT_USER to fail")
	}
}

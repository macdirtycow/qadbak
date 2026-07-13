package panels

import "testing"

func TestValidatePanelBaseURL(t *testing.T) {
	ok, err := ValidatePanelBaseURL("https://127.0.0.1:8083")
	if err != nil || ok != "https://127.0.0.1:8083" {
		t.Fatalf("loopback https: %q %v", ok, err)
	}
	ep, err := ResolveLoopbackEndpoint("http://localhost:8000", "http", 80)
	if err != nil || ep.port != 8000 || ep.URL("/api") != "http://127.0.0.1:8000/api" {
		t.Fatalf("canonical localhost: %+v %v", ep, err)
	}
	_, err = ValidatePanelBaseURL("http://10.0.0.1:8000")
	if err == nil {
		t.Fatal("expected reject remote host")
	}
	_, err = ValidatePanelBaseURL("ftp://127.0.0.1/")
	if err == nil {
		t.Fatal("expected reject ftp scheme")
	}
}

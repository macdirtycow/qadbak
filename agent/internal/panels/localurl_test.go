package panels

import "testing"

func TestValidatePanelBaseURL(t *testing.T) {
	ok, err := ValidatePanelBaseURL("https://127.0.0.1:8083")
	if err != nil || ok != "https://127.0.0.1:8083" {
		t.Fatalf("loopback https: %q %v", ok, err)
	}
	u, err := ParseLoopbackPanelURL("http://localhost:8000")
	if err != nil || u.Host != "127.0.0.1:8000" {
		t.Fatalf("canonical localhost: %v %v", u, err)
	}
	_, err = ValidatePanelBaseURL("http://10.0.0.1:8000")
	if err == nil {
		t.Fatal("expected reject remote host")
	}
	_, err = ValidatePanelBaseURL("ftp://127.0.0.1/")
	if err == nil {
		t.Fatal("expected reject ftp scheme")
	}
	endpoint, err := JoinPanelPath(u, "/api/v1/applications")
	if err != nil || endpoint != "http://127.0.0.1:8000/api/v1/applications" {
		t.Fatalf("join path: %q %v", endpoint, err)
	}
}

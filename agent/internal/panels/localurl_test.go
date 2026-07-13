package panels

import "testing"

func TestValidatePanelBaseURL(t *testing.T) {
	ok, err := ValidatePanelBaseURL("https://127.0.0.1:8083")
	if err != nil || ok != "https://127.0.0.1:8083" {
		t.Fatalf("loopback https: %q %v", ok, err)
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

package httploopback

import "testing"

func TestRequestURL(t *testing.T) {
	got := RequestURL("https", 8083, "/api/")
	want := "https://127.0.0.1:8083/api/"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

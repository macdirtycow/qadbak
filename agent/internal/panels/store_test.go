package panels

import "testing"

func TestIsLinkableOpenSourceOnly(t *testing.T) {
	if !IsLinkable("hestiaCP") || !IsLinkable("coolify") || !IsLinkable("casaOS") {
		t.Fatal("expected OSS panels to be linkable")
	}
	if IsLinkable("plesk") || IsLinkable("directAdmin") || IsLinkable("qadbakPanel") {
		t.Fatal("expected proprietary / native panels not to use agent linking")
	}
}

func TestPublicFromConfigMasksSecrets(t *testing.T) {
	cfg := &LinkConfig{
		Panel: "coolify",
		Secrets: map[string]string{
			"apiToken": "abcdefgh1234",
		},
	}
	st := PublicFromConfig(cfg, "coolify")
	if st.Hint == "" || st.Hint == "abcdefgh1234" {
		t.Fatalf("expected masked hint, got %q", st.Hint)
	}
}

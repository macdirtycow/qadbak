package panels

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTLSServerNameFromPEM(t *testing.T) {
	pemBytes := mustPEM(t, "panel.example.com", nil)
	if got := tlsServerNameFromPEM(pemBytes); got != "panel.example.com" {
		t.Fatalf("got %q", got)
	}

	sanPEM := mustPEM(t, "localhost", []string{"panel.example.com", "localhost"})
	if got := tlsServerNameFromPEM(sanPEM); got != "panel.example.com" {
		t.Fatalf("expected first non-localhost SAN, got %q", got)
	}
}

func TestHestiaConfValue(t *testing.T) {
	dir := t.TempDir()
	conf := filepath.Join(dir, "hestia.conf")
	if err := os.WriteFile(conf, []byte("FOO=bar\nHOSTNAME='panel.example.com'\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	old := hestiaConfPath
	hestiaConfPath = conf
	t.Cleanup(func() { hestiaConfPath = old })

	if got := hestiaConfValue("HOSTNAME"); got != "panel.example.com" {
		t.Fatalf("got %q", got)
	}
}

func mustPEM(t *testing.T, cn string, sans []string) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: cn},
		DNSNames:     sans,
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

package config

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	DataDir         string
	TLSCertPath     string
	TLSKeyPath      string
	Version         string
	MinAppVersion   string
	MinAgentVersion string
	JWTSecret       []byte
}

const defaultMinAppVersion = "1.2.0"

func Load(dataDir, version string) *Config {
	return &Config{
		DataDir:         dataDir,
		TLSCertPath:     filepath.Join(dataDir, "tls.crt"),
		TLSKeyPath:      filepath.Join(dataDir, "tls.key"),
		Version:         version,
		MinAppVersion:   defaultMinAppVersion,
		MinAgentVersion: version,
		JWTSecret:       loadJWTSecret(dataDir),
	}
}

func loadJWTSecret(dataDir string) []byte {
	if env := strings.TrimSpace(os.Getenv("QADBAK_AGENT_JWT_SECRET")); env != "" {
		return []byte(env)
	}
	for _, path := range []string{
		"/etc/qadbak-agent/jwt.secret",
		filepath.Join(dataDir, "jwt.secret"),
	} {
		if b, err := os.ReadFile(path); err == nil {
			if s := strings.TrimSpace(string(b)); s != "" {
				return []byte(s)
			}
		}
	}
	return []byte("dev-only-change-in-production")
}

// EnsureJWTSecretFile creates a persistent secret for production installs.
func EnsureJWTSecretFile(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(hex.EncodeToString(buf)+"\n"), 0o640)
}

func (c *Config) Ensure() error {
	return os.MkdirAll(c.DataDir, 0o750)
}

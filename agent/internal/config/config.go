package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	DataDir      string
	TLSCertPath  string
	TLSKeyPath   string
	Version      string
	MinAppVersion string
	JWTSecret    []byte
}

func Load(dataDir, version string) *Config {
	secret := os.Getenv("QADBAK_AGENT_JWT_SECRET")
	if secret == "" {
		secret = "dev-only-change-in-production"
	}
	return &Config{
		DataDir:       dataDir,
		TLSCertPath:   filepath.Join(dataDir, "tls.crt"),
		TLSKeyPath:    filepath.Join(dataDir, "tls.key"),
		Version:       version,
		MinAppVersion: "1.1.0",
		JWTSecret:     []byte(secret),
	}
}

func (c *Config) Ensure() error {
	return os.MkdirAll(c.DataDir, 0o750)
}

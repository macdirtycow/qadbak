package main

import (
	"context"
	"crypto/tls"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/macdirtycow/qadbak/agent/internal/auth"
	"github.com/macdirtycow/qadbak/agent/internal/config"
	"github.com/macdirtycow/qadbak/agent/internal/netlisten"
	"github.com/macdirtycow/qadbak/agent/internal/handlers"
	"github.com/macdirtycow/qadbak/agent/internal/privilege"
	"github.com/macdirtycow/qadbak/agent/internal/system"
	"github.com/macdirtycow/qadbak/agent/internal/tlsutil"
)

const version = "0.6.17"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "priv" {
		privilege.MainExit(os.Args[2:])
	}

	var (
		listen   = flag.String("listen", envOr("QADBAK_AGENT_LISTEN", netlisten.Default(9443)), "HTTPS listen address (default: 127.0.0.1:9443; set QADBAK_AGENT_LISTEN_MODE=tailscale|lan during install)")
		dataDir  = flag.String("data-dir", envOr("QADBAK_AGENT_DATA_DIR", "/var/lib/qadbak-agent"), "State directory")
		certFile = flag.String("cert", "", "TLS certificate file")
		keyFile  = flag.String("key", "", "TLS private key file")
	)
	flag.Parse()

	cfg := config.Load(*dataDir, version)
	if err := cfg.Ensure(); err != nil {
		log.Fatalf("config: %v", err)
	}

	store, err := auth.NewStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("auth store: %v", err)
	}

	certPath, keyPath := *certFile, *keyFile
	if certPath == "" || keyPath == "" {
		certPath = cfg.TLSCertPath
		keyPath = cfg.TLSKeyPath
	}
	if err := tlsutil.EnsureCertificate(certPath, keyPath, *listen); err != nil {
		log.Fatalf("tls: %v", err)
	}

	mux := http.NewServeMux()
	h := handlers.New(cfg, store, certPath)
	h.Register(mux)

	server := &http.Server{
		Addr:              *listen,
		Handler:           withLogging(withRecovery(mux)),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		metrics := system.NewMetricsHistory(cfg.DataDir)
		for range ticker.C {
			overview := system.CollectOverview(version)
			_ = metrics.RecordFromOverview(overview)
		}
	}()

	go func() {
		log.Printf("qadbak-agent %s listening on https://%s", version, *listen)
		if err := server.ListenAndServeTLS(certPath, keyPath); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				handlers.WriteJSON(w, http.StatusInternalServerError, map[string]any{
					"ok":    false,
					"error": "Internal error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

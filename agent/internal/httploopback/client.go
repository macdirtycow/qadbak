package httploopback

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

var loopbackRootCAs = loadLoopbackRootCAs()

func loadLoopbackRootCAs() *x509.CertPool {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	for _, path := range []string{
		"/usr/local/hestia/ssl/certificate.crt",
		"/usr/local/hestia/ssl/server.crt",
	} {
		pem, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		pool.AppendCertsFromPEM(pem)
	}
	return pool
}

// Client returns an HTTP client that always dials 127.0.0.1 on the given port,
// regardless of the URL host used in requests. For HTTPS, tlsServerName sets TLS
// SNI/certificate hostname verification (empty defaults to "localhost").
func Client(scheme string, port int) *http.Client {
	return ClientWithServerName(scheme, port, "")
}

func ClientWithServerName(scheme string, port int, tlsServerName string) *http.Client {
	if port < 1 || port > 65535 {
		port = 80
	}
	dialAddr := net.JoinHostPort("127.0.0.1", strconv.Itoa(port))
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			_ = address
			d := &net.Dialer{Timeout: 30 * time.Second}
			return d.DialContext(ctx, network, dialAddr)
		},
	}
	if scheme == "https" {
		if tlsServerName == "" {
			tlsServerName = "localhost"
		}
		transport.TLSClientConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
			RootCAs:    loopbackRootCAs,
			ServerName: tlsServerName,
		}
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}
}

// Do sends a loopback-only HTTP request (host must be 127.0.0.1 or localhost).
func Do(client *http.Client, req *http.Request) (*http.Response, error) {
	if client == nil || req == nil || req.URL == nil {
		return nil, fmt.Errorf("invalid loopback request")
	}
	switch req.URL.Hostname() {
	case "127.0.0.1", "localhost":
	default:
		return nil, fmt.Errorf("loopback host not allowed")
	}
	return client.Do(req)
}

// RequestURL builds a loopback request URL; the client dialer still pins 127.0.0.1:port.
func RequestURL(scheme string, port int, path string) string {
	if scheme != "http" && scheme != "https" {
		scheme = "http"
	}
	if port < 1 || port > 65535 {
		port = 80
	}
	if path == "" {
		path = "/"
	}
	if path[0] != '/' {
		path = "/" + path
	}
	return fmt.Sprintf("%s://127.0.0.1:%d%s", scheme, port, path)
}

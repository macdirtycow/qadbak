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

// RequestURL builds a loopback request URL with a fixed host; the client dialer pins the port.
func RequestURL(path string) string {
	if path == "" {
		path = "/"
	}
	if path[0] != '/' {
		path = "/" + path
	}
	return fmt.Sprintf("http://127.0.0.1%s", path)
}

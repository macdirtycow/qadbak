package httploopback

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"
)

// Client returns an HTTP client that always dials 127.0.0.1 on the given port,
// regardless of the URL host used in requests.
func Client(scheme string, port int) *http.Client {
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
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true, //nolint:gosec // loopback-only; dial is pinned to 127.0.0.1
			MinVersion:         tls.VersionTLS12,
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

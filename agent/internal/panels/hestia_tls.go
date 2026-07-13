package panels

import (
	"crypto/x509"
	"encoding/pem"
	"os"
	"strings"
)

const hestiaConfDefaultPath = "/usr/local/hestia/conf/hestia.conf"

var hestiaConfPath = hestiaConfDefaultPath

var hestiaCertPaths = []string{
	"/usr/local/hestia/ssl/certificate.crt",
	"/usr/local/hestia/ssl/server.crt",
}

// hestiaTLSServerName is the TLS SNI hostname when dialing 127.0.0.1:8083.
// Hestia panel certs are usually issued for the server FQDN, not "localhost".
func hestiaTLSServerName() string {
	for _, path := range hestiaCertPaths {
		if name := tlsServerNameFromCertFile(path); name != "" {
			return name
		}
	}
	if name := hestiaConfValue("HOSTNAME"); name != "" {
		return name
	}
	if name, err := os.Hostname(); err == nil {
		name = strings.TrimSpace(name)
		if name != "" && !strings.EqualFold(name, "localhost") {
			return name
		}
	}
	return "localhost"
}

func hestiaConfValue(key string) string {
	data, err := os.ReadFile(hestiaConfPath)
	if err != nil {
		return ""
	}
	prefix := key + "="
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, prefix) {
			continue
		}
		val := strings.TrimSpace(strings.TrimPrefix(line, prefix))
		return strings.Trim(val, `"'`)
	}
	return ""
}

func tlsServerNameFromCertFile(path string) string {
	pemBytes, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return tlsServerNameFromPEM(pemBytes)
}

func tlsServerNameFromPEM(pemBytes []byte) string {
	var block *pem.Block
	for {
		block, pemBytes = pem.Decode(pemBytes)
		if block == nil {
			return ""
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			continue
		}
		for _, dns := range cert.DNSNames {
			dns = strings.TrimSpace(dns)
			if dns != "" && !strings.EqualFold(dns, "localhost") {
				return dns
			}
		}
		cn := strings.TrimSpace(cert.Subject.CommonName)
		if cn != "" && !strings.EqualFold(cn, "localhost") {
			return cn
		}
	}
}

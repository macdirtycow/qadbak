package system_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/system"
)

func TestParseServiceList(t *testing.T) {
	sample := []byte(`nginx.service      loaded active running   A high performance web server
ssh.service        loaded active running   OpenBSD Secure Shell server
failed.service     loaded failed failed    Example failed unit
`)
	services := system.ParseServiceListForTest(sample, 10)
	if len(services) != 3 {
		t.Fatalf("expected 3 services, got %d", len(services))
	}
	if services[0].ID != "nginx.service" || services[0].Status != "active" {
		t.Fatalf("unexpected first service: %+v", services[0])
	}
	if services[2].Status != "failed" {
		t.Fatalf("expected failed status, got %s", services[2].Status)
	}
	if services[0].CanManage != true {
		t.Fatalf("expected CanManage true in phase 4, got %+v", services[0])
	}
}

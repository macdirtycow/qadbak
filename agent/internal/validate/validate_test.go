package validate_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

func TestServiceUnit(t *testing.T) {
	if !validate.ServiceUnit("nginx.service") {
		t.Fatal("expected valid service")
	}
	if validate.ServiceUnit("nginx; rm -rf") {
		t.Fatal("expected invalid service")
	}
}

func TestContainerID(t *testing.T) {
	if !validate.ContainerID("a1b2c3d4e5f6") {
		t.Fatal("expected valid container id")
	}
	if validate.ContainerID("not-a-container") {
		t.Fatal("expected invalid container id")
	}
}

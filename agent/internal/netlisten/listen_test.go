package netlisten

import (
	"testing"
)

func TestDefaultLoopback(t *testing.T) {
	t.Setenv("QADBAK_AGENT_LISTEN", "")
	t.Setenv("QADBAK_AGENT_LISTEN_MODE", "")
	if got := Default(9443); got != "127.0.0.1:9443" {
		t.Fatalf("Default() = %q, want 127.0.0.1:9443", got)
	}
}

func TestResolveExplicitListen(t *testing.T) {
	t.Setenv("QADBAK_AGENT_LISTEN", "10.0.0.5:9443")
	t.Setenv("QADBAK_AGENT_LISTEN_MODE", "lan")
	if got := Resolve(9443); got != "10.0.0.5:9443" {
		t.Fatalf("Resolve() = %q", got)
	}
}

func TestResolveLANMode(t *testing.T) {
	t.Setenv("QADBAK_AGENT_LISTEN", "")
	t.Setenv("QADBAK_AGENT_LISTEN_MODE", "lan")
	if got := Resolve(9443); got != "0.0.0.0:9443" {
		t.Fatalf("Resolve(lan) = %q", got)
	}
}

func TestResolveLocalMode(t *testing.T) {
	t.Setenv("QADBAK_AGENT_LISTEN", "")
	t.Setenv("QADBAK_AGENT_LISTEN_MODE", "local")
	if got := Resolve(9443); got != "127.0.0.1:9443" {
		t.Fatalf("Resolve(local) = %q", got)
	}
}

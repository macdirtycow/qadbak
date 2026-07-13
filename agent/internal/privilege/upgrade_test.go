package privilege_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

func TestAgentUpgradeRejectsBadPath(t *testing.T) {
	if err := privilege.Dispatch([]string{"agent-upgrade", "/tmp/evil"}); err == nil {
		t.Fatal("expected invalid path")
	}
	if err := privilege.Dispatch([]string{"agent-upgrade", "/var/lib/qadbak-agent/upgrade/qadbak-agent-staging"}); err == nil {
		t.Fatal("expected missing staging file error")
	}
}

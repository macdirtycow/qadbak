package privilege_test

import (
	"testing"

	"github.com/macdirtycow/qadbak/agent/internal/privilege"
)

func TestDispatchRejectsInvalidService(t *testing.T) {
	if err := privilege.Dispatch([]string{"systemctl", "restart", "bad;unit"}); err == nil {
		t.Fatal("expected invalid service to fail")
	}
}

func TestDispatchRejectsUnknownAction(t *testing.T) {
	if err := privilege.Dispatch([]string{"shell", "rm", "-rf"}); err == nil {
		t.Fatal("expected unknown action to fail")
	}
}

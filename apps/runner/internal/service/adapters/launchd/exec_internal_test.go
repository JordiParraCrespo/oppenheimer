//go:build unix

package launchd

import (
	"context"
	"strings"
	"testing"
	"time"
)

// A wedged launchd must not hang install, update or uninstall: every call runs
// under a bounded timeout and says so when it hits it.
func TestExecCommandsTimesOut(t *testing.T) {
	start := time.Now()
	_, err := execCommands{timeout: 100 * time.Millisecond}.Run(context.Background(), "sleep", "30")
	if err == nil {
		t.Fatal("a command past its timeout succeeded")
	}
	if elapsed := time.Since(start); elapsed > 10*time.Second {
		t.Fatalf("Run returned after %s, want about the 100ms timeout", elapsed)
	}
	if !strings.Contains(err.Error(), "timed out after 100ms") {
		t.Fatalf("err = %q, want it to say it timed out", err)
	}
}

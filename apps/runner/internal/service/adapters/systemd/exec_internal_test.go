//go:build unix

package systemd

import (
	"context"
	"strings"
	"testing"
	"time"
)

// A wedged user bus must not hang install, update or uninstall: every call runs
// under a bounded timeout and says so when it hits it.
func TestExecCommandsTimesOut(t *testing.T) {
	if commandTimeout <= 0 {
		t.Fatalf("commandTimeout = %s; the calls the manager makes would be unbounded", commandTimeout)
	}
	cases := []struct {
		name     string
		commands execCommands
		// deadline cuts the wait short; the message still names the bound
		// Run chose.
		deadline time.Duration
		want     string
	}{
		{"its own timeout", execCommands{timeout: 100 * time.Millisecond}, time.Minute, "timed out after 100ms"},
		{"the zero value's default", execCommands{}, 100 * time.Millisecond, "timed out after " + commandTimeout.String()},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), tc.deadline)
			defer cancel()
			start := time.Now()
			_, err := tc.commands.Run(ctx, "sleep", "30")
			if err == nil {
				t.Fatal("a command past its timeout succeeded")
			}
			if elapsed := time.Since(start); elapsed > 10*time.Second {
				t.Fatalf("Run returned after %s, want about 100ms", elapsed)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("err = %q, want %q", err, tc.want)
			}
		})
	}
}

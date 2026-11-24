package systemd_test

import (
	"context"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/adapters/systemd"
)

type ctxCommands struct{ cancelled bool }

func (c *ctxCommands) Run(ctx context.Context, _ string, _ ...string) (string, error) {
	c.cancelled = ctx.Err() != nil
	return "", nil
}

// The daemon restarting itself is the process the restart stops: its shutdown
// cancels the context it asked under, and a command tied to that context was
// killed mid-restart and reported a restart that went through as a failure.
func TestRestartOutlivesTheCallersCancellation(t *testing.T) {
	commands := &ctxCommands{}
	m := systemd.New(systemd.Options{Dir: t.TempDir(), Commands: commands})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := m.Restart(ctx); err != nil {
		t.Fatal(err)
	}
	if commands.cancelled {
		t.Fatal("the restart command ran under the caller's cancelled context")
	}
}

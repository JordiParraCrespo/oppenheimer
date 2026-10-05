package cli_test

import (
	"bytes"
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// tallyTerminals counts the per-session and per-host tmux calls a listing
// makes.
type tallyTerminals struct {
	*fake.Terminals

	mu               sync.Mutex
	has, panes, caps int
}

func (c *tallyTerminals) Has(ctx context.Context, name string) (bool, error) {
	c.mu.Lock()
	c.has++
	c.mu.Unlock()
	return c.Terminals.Has(ctx, name)
}

func (c *tallyTerminals) Capture(ctx context.Context, target string) (sessionsapp.Screen, error) {
	c.mu.Lock()
	c.caps++
	c.mu.Unlock()
	return c.Terminals.Capture(ctx, target)
}

func (c *tallyTerminals) Panes(ctx context.Context) ([]sessionsapp.Pane, error) {
	c.mu.Lock()
	c.panes++
	c.mu.Unlock()
	return c.Terminals.Panes(ctx)
}

// One `list-panes` for every session, never a `has-session` and a
// `capture-pane` round per session; a tmux session killed behind the runner's
// back is listed as stopped.
func TestListSessionsRefreshesTheHostInOnePass(t *testing.T) {
	terminals := &tallyTerminals{Terminals: fake.NewTerminals()}
	app, _ := hostApp(t, terminals, fake.NewWorktrees())
	openSession(t, app)
	openSession(t, app)
	gone := openSession(t, app)
	if err := terminals.Kill(context.Background(), gone.TmuxName()); err != nil {
		t.Fatal(err)
	}
	terminals.mu.Lock()
	terminals.has, terminals.panes, terminals.caps = 0, 0, 0
	terminals.mu.Unlock()

	var out bytes.Buffer
	if err := app.ListSessions(context.Background(), &out); err != nil {
		t.Fatal(err)
	}

	terminals.mu.Lock()
	has, panes, caps := terminals.has, terminals.panes, terminals.caps
	terminals.mu.Unlock()
	if panes != 1 || has != 0 || caps != 0 {
		t.Fatalf("panes=%d has=%d capture=%d; want one list-panes and no per-session probe", panes, has, caps)
	}
	var stopped string
	for _, line := range strings.Split(out.String(), "\n") {
		if strings.HasPrefix(line, gone.ID) {
			stopped = line
		}
	}
	if !strings.Contains(stopped, "stopped") {
		t.Fatalf("the killed session is not listed as stopped:\n%s", out.String())
	}
}

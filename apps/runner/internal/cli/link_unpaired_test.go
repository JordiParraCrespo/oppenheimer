package cli

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A host unpaired while a create is still cloning: the clone is cancelled and
// waited for before the sessions are stopped, so no tmux session starts behind
// the stop — the agent that would otherwise run where no console can see it.
// A create that arrives after the verdict does not run at all.
func TestUnpairingCancelsACreateInFlightBeforeItsTmuxStarts(t *testing.T) {
	h, _, git, terminals := newCreateHarness(t)
	h.life, h.endLife = context.WithCancel(context.Background())

	h.Message(context.Background(), createMessage(t, "11111111-1111-4111-8111-111111111111"))
	git.mu.Lock()
	for deadline := time.Now().Add(2 * time.Second); git.clones == 0; {
		git.mu.Unlock()
		if time.Now().After(deadline) {
			t.Fatal("the create never started cloning")
		}
		time.Sleep(time.Millisecond)
		git.mu.Lock()
	}
	git.mu.Unlock()

	// The clone finishes only once the host has already been told it is
	// unpaired: the worst moment, since a create that ignored the verdict
	// would go straight on to start tmux.
	go func() {
		time.Sleep(20 * time.Millisecond)
		close(git.release)
	}()
	h.unpaired(context.Background())

	if names, _ := terminals.List(context.Background()); len(names) != 0 {
		t.Fatalf("a tmux session outlived the unpairing: %v", names)
	}

	h.Message(context.Background(), createMessage(t, "22222222-2222-4222-8222-222222222222"))
	time.Sleep(50 * time.Millisecond)
	git.mu.Lock()
	clones := git.clones
	git.mu.Unlock()
	if clones != 1 {
		t.Fatalf("a create after the verdict cloned again (%d clones)", clones)
	}
	if names, _ := terminals.List(context.Background()); len(names) != 0 {
		t.Fatalf("a create after the verdict started tmux: %v", names)
	}
}

// flakyKill is tmux that refuses to kill the first few times it is asked.
type flakyKill struct {
	*fake.Terminals
	mu    sync.Mutex
	fails int
}

func (f *flakyKill) Kill(ctx context.Context, name string) error {
	f.mu.Lock()
	if f.fails > 0 {
		f.fails--
		f.mu.Unlock()
		return errors.New("tmux: server busy")
	}
	f.mu.Unlock()
	return f.Terminals.Kill(ctx, name)
}

// No second verdict comes, so a stop that fails is tried again until the
// session is gone.
func TestAnUnpairedHostKeepsTryingToStopASessionItCouldNot(t *testing.T) {
	unpairedRetry = time.Millisecond
	t.Cleanup(func() { unpairedRetry = time.Second })

	terminals := &flakyKill{Terminals: fake.NewTerminals(), fails: 2}
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := svc.Create(ctx, sessionsapp.CreateInput{
		ID: sessionUnderTest, Repo: "acme-labs/xrp-mobile", Remote: "https://github.com/acme-labs/xrp-mobile.git",
		BaseBranch: "main", Branch: "oppenheimer/bright-lark", Name: "bright-lark", Agent: sessionsdomain.AgentClaude,
	}); err != nil {
		t.Fatal(err)
	}
	if names, _ := terminals.List(ctx); len(names) != 1 {
		t.Fatalf("the session did not start: %v", names)
	}

	h := &linkHandler{
		app: &App{Sessions: svc}, logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{}, life: ctx, lanes: newLanes(),
	}
	h.unpaired(ctx)

	if names, _ := terminals.List(ctx); len(names) != 0 {
		t.Fatalf("a tmux session outlived the unpairing: %v", names)
	}
}

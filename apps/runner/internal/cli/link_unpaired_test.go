package cli

import (
	"context"
	"testing"
	"time"
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

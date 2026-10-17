//go:build darwin || linux

package cli

import (
	"context"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

type slowUpdater struct {
	running atomic.Int32
	overlap atomic.Bool
}

func (s *slowUpdater) Update(context.Context, string, string, []string) error {
	if s.running.Add(1) > 1 {
		s.overlap.Store(true)
	}
	time.Sleep(50 * time.Millisecond)
	s.running.Add(-1)
	return nil
}

// blockingUpdater holds its agent's lock until the test lets it finish.
type blockingUpdater struct{ held, finish chan struct{} }

func (b blockingUpdater) Update(context.Context, string, string, []string) error {
	close(b.held)
	<-b.finish
	return nil
}

func TestAgentLockSerialisesUpdatersAndHoldsLaunches(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	if err := os.MkdirAll(paths.Run(), 0o700); err != nil {
		t.Fatal(err)
	}
	inner := &slowUpdater{}
	// Two updaters, as if the daemon's round and `runner agents update` ran
	// together: each takes its own file descriptor, as two processes would.
	done := make(chan struct{}, 2)
	for range 2 {
		go func() {
			_ = lockedUpdater{paths: paths, next: inner}.Update(context.Background(), "claude", "/bin/claude", []string{"update"})
			done <- struct{}{}
		}()
	}
	// A launch while an update holds the lock waits for it: wait until one
	// updater is inside the lock, not a fixed sleep a loaded machine outruns.
	for deadline := time.Now().Add(5 * time.Second); inner.running.Load() == 0; {
		if time.Now().After(deadline) {
			t.Fatal("no updater took the lock")
		}
		time.Sleep(time.Millisecond)
	}
	start := time.Now()
	release := agentGate{paths: paths}.Hold(context.Background(), "claude")
	release()
	if waited := time.Since(start); waited < 20*time.Millisecond {
		t.Errorf("the launch waited %s; it should have waited on the update", waited)
	}
	<-done
	<-done
	if inner.overlap.Load() {
		t.Fatal("two updaters of one CLI ran at once")
	}
	// Another agent's launch does not wait on claude's lock: while claude's
	// updater holds it, codex still gets through. A codex that waited would
	// block until that update ends, which this test never lets happen; the
	// bound is a few polls of the lock, far inside launchWaitLimit, so it
	// tells "waited on claude" apart without timing how fast a launch is.
	held := make(chan struct{})
	finish := make(chan struct{})
	updated := make(chan error, 1)
	go func() {
		updated <- lockedUpdater{paths: paths, next: blockingUpdater{held: held, finish: finish}}.
			Update(context.Background(), "claude", "/bin/claude", []string{"update"})
	}()
	<-held
	codex := make(chan struct{})
	go func() {
		agentGate{paths: paths}.Hold(context.Background(), "codex")()
		close(codex)
	}()
	select {
	case <-codex:
	case <-time.After(20 * agentLockPoll):
		t.Fatal("codex waited on claude's update")
	}
	close(finish)
	if err := <-updated; err != nil {
		t.Fatal(err)
	}
}

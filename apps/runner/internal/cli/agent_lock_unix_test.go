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
	// Another agent's launch does not wait on claude's lock.
	start = time.Now()
	agentGate{paths: paths}.Hold(context.Background(), "codex")()
	if waited := time.Since(start); waited > 20*time.Millisecond {
		t.Errorf("codex waited %s on nothing", waited)
	}
}

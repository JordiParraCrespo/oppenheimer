package cli

import (
	"reflect"
	"sync"
	"testing"
	"time"
)

// recorder collects what jobs ran, in order, across goroutines.
type recorder struct {
	mu  sync.Mutex
	ran []string
}

func (r *recorder) job(name string) func() {
	return func() {
		r.mu.Lock()
		r.ran = append(r.ran, name)
		r.mu.Unlock()
	}
}

func (r *recorder) waitFor(t *testing.T, n int) []string {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		r.mu.Lock()
		got := append([]string(nil), r.ran...)
		r.mu.Unlock()
		if len(got) >= n {
			return got
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("only %d of %d jobs ran", len(r.ran), n)
	return nil
}

// An attach, input or stop sent right after a create waits for it, and they
// run in the order they were sent.
func TestALaneRunsOneSessionsCommandsInOrderAfterTheCreate(t *testing.T) {
	l, r := newLanes(), &recorder{}
	release := make(chan struct{})

	l.run("s1", func() { <-release; r.job("create")() })
	l.run("s1", r.job("attach"))
	l.run("s1", r.job("input"))
	l.run("s2", r.job("another session"))

	if got := r.waitFor(t, 1); !reflect.DeepEqual(got, []string{"another session"}) {
		t.Fatalf("ran %v while s1's create was running; only another session may", got)
	}
	close(release)
	got := r.waitFor(t, 4)
	if want := []string{"another session", "create", "attach", "input"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("ran %v, want %v", got, want)
	}
}

// A create that fails is a job that returned: what waited on it still runs,
// and the lane takes new work afterwards instead of staying wedged.
func TestALaneGoesOnAfterAFailedCreate(t *testing.T) {
	l, r := newLanes(), &recorder{}

	l.run("s1", func() { r.job("create failed")() })
	l.run("s1", r.job("stop"))
	r.waitFor(t, 2)
	l.run("s1", r.job("redelivered create"))

	got := r.waitFor(t, 3)
	if want := []string{"create failed", "stop", "redelivered create"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("ran %v, want %v", got, want)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		l.mu.Lock()
		idle := len(l.queues) == 0
		l.mu.Unlock()
		if idle {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the lane never went idle")
		}
		time.Sleep(time.Millisecond)
	}
}

// The regression `detach` exists for: a create holds its session's lane only
// until the pane exists, and the work queued behind it — an attach, above all —
// starts then, rather than waiting out the clone the pane does not depend on.
// Holding the lane through the whole create is what made the console wait for a
// clone before its attach was even read.
func TestWorkQueuedBehindACreateStartsOnceTheLaneIsHandedBack(t *testing.T) {
	l, r := newLanes(), &recorder{}
	paneReady := make(chan struct{})
	finishCreate := make(chan struct{})

	l.run("s1", func() {
		// What a create does: the remainder leaves the lane, and the lane job
		// returns as soon as the pane is there.
		l.detach(func() {
			<-finishCreate
			r.job("create-finished")()
		})
		close(paneReady)
	})
	<-paneReady
	l.run("s1", r.job("attach"))

	// The attach runs while the create's remainder is still going.
	if got := r.waitFor(t, 1); !reflect.DeepEqual(got, []string{"attach"}) {
		t.Fatalf("ran %v; want the attach to go before the create had finished", got)
	}

	close(finishCreate)
	if got := r.waitFor(t, 2); !reflect.DeepEqual(got, []string{"attach", "create-finished"}) {
		t.Fatalf("ran %v; want [attach create-finished]", got)
	}
}

// A detached remainder is still the lanes' work: unpairing waits for it, or a
// create would go on cloning into a host that believes it has stopped.
func TestCloseWaitsForWorkThatLeftItsLane(t *testing.T) {
	l, r := newLanes(), &recorder{}
	running := make(chan struct{})
	release := make(chan struct{})

	l.run("s1", func() {
		l.detach(func() {
			close(running)
			<-release
			r.job("detached-finished")()
		})
	})
	<-running

	done := make(chan bool, 1)
	go func() { done <- l.close(2 * time.Second) }()
	select {
	case <-done:
		t.Fatal("close returned while the detached work was still running")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	if !<-done {
		t.Fatal("close timed out waiting for the detached work")
	}
	if got := r.waitFor(t, 1); !reflect.DeepEqual(got, []string{"detached-finished"}) {
		t.Fatalf("ran %v; want the detached work to have finished", got)
	}
}

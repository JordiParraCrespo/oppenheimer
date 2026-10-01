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

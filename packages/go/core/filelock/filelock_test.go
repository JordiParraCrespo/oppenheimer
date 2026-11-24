//go:build darwin || linux

package filelock_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/filelock"
)

// One holder at a time, whoever opened the file: a second Acquire waits for
// the first's release, TryAcquire and Held see it held, and a wait whose
// context ends gives up rather than hang. Regresses if the lock is per
// process or per descriptor in a way two holders in one process both get.
func TestOneHolderAtATime(t *testing.T) {
	path := filepath.Join(t.TempDir(), "locks", "x.lock")
	release, err := filelock.Acquire(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := filelock.TryAcquire(path); ok {
		t.Fatal("TryAcquire took a held lock")
	}
	if !filelock.Held(path) {
		t.Fatal("Held says free while held")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()
	if _, err := filelock.Acquire(ctx, path); err == nil {
		t.Fatal("a second Acquire took a held lock")
	}

	got := make(chan struct{})
	go func() {
		if r, err := filelock.Acquire(context.Background(), path); err == nil {
			r()
		}
		close(got)
	}()
	release()
	select {
	case <-got:
	case <-time.After(2 * time.Second):
		t.Fatal("Acquire did not get the lock after its release")
	}
	if filelock.Held(path) {
		t.Fatal("Held says held after every release")
	}
	if err := filelock.Wait(context.Background(), path); err != nil {
		t.Fatal(err)
	}
}

//go:build darwin || linux

package git

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// fileLock is a lock other runner processes on the host see: the daemon
// and `runner sessions …` on the host, several of them at once, share the
// work folder. The kernel owns it, so a process that dies drops it.
type fileLock struct{ f *os.File }

// lockPath is the file a store's lock of kind is taken on: in the
// workspace's own `.oppenheimer/locks/`, so the store's directory need not
// exist yet and nothing is left among the stores.
func lockPath(store, kind string) string {
	workspace := filepath.Dir(filepath.Dir(store))
	return filepath.Join(workspace, ".oppenheimer", "locks", filepath.Base(store)+"."+kind+".lock")
}

func openLock(path string) (*fileLock, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // a fixed name beside a store the runner made
	if err != nil {
		return nil, err
	}
	return &fileLock{f: f}, nil
}

// tryLock takes the lock if nobody holds it, and reports whether it did.
func (l *fileLock) tryLock() bool {
	err := syscall.Flock(int(l.f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	return err == nil
}

// lock waits for the lock until ctx ends.
func (l *fileLock) lock(ctx context.Context) error {
	for {
		err := syscall.Flock(int(l.f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			return nil
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func (l *fileLock) release() {
	_ = syscall.Flock(int(l.f.Fd()), syscall.LOCK_UN)
	_ = l.f.Close()
}

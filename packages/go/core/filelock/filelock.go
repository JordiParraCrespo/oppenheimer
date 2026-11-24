//go:build darwin || linux

// Package filelock is a lock other processes on the same host see: a flock
// on a named file. Two processes of one service over one directory (a
// daemon and a CLI beside it, several of them at once) take turns through
// it. The kernel owns the lock, so a process that dies drops it and nothing
// stale is left to clean up. The file is never deleted: unlinking a lock
// file another process is waiting on hands two of them the lock.
package filelock

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// poll is how often Acquire tries again while another holds the lock.
const poll = 50 * time.Millisecond

// Acquire takes the lock at path, waiting while another holds it, until ctx
// ends. The file and its directory are made when missing (0600, 0700).
// release drops the lock.
func Acquire(ctx context.Context, path string) (release func(), err error) {
	f, err := open(path)
	if err != nil {
		return nil, err
	}
	for {
		err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			return func() { unlock(f) }, nil
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) {
			_ = f.Close()
			return nil, err
		}
		select {
		case <-ctx.Done():
			_ = f.Close()
			return nil, ctx.Err()
		case <-time.After(poll):
		}
	}
}

// TryAcquire takes the lock at path only if nobody holds it, and reports
// whether it did.
func TryAcquire(path string) (release func(), ok bool, err error) {
	f, err := open(path)
	if err != nil {
		return nil, false, err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return func() { unlock(f) }, true, nil
}

// Held reports whether another holder has the lock at path right now. It
// takes the lock for an instant to find out, so a TryAcquire racing it may
// see it held.
func Held(path string) bool {
	release, ok, err := TryAcquire(path)
	if err != nil {
		return false
	}
	if ok {
		release()
	}
	return !ok
}

// Wait returns once nobody holds the lock at path, or with ctx's error.
func Wait(ctx context.Context, path string) error {
	release, err := Acquire(ctx, path)
	if err != nil {
		return err
	}
	release()
	return nil
}

func open(path string) (*os.File, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // the caller's own lock file
}

func unlock(f *os.File) {
	_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
	_ = f.Close()
}

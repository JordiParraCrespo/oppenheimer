//go:build darwin || linux

package cli

import (
	"fmt"
	"os"
	"syscall"
)

// Lock takes the single-instance lock. Two runners on one host would fight
// over the tmux server and the worktrees, so the second one fails loudly here
// instead of quietly corrupting the first one's state.
//
// The returned release closes the file, which drops the lock; a runner that
// is killed drops it too, because the kernel owns it, not a stale pid file.
func Lock(path string) (release func(), err error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // the path is the runner's own lock file, under a 0700 directory it owns
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		return nil, fmt.Errorf("another runner already holds %s: %w", path, err)
	}
	if _, err := fmt.Fprintf(f, "%d\n", os.Getpid()); err != nil {
		_ = f.Close()
		return nil, err
	}
	return func() {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
		_ = f.Close()
	}, nil
}

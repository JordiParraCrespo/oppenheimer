//go:build darwin || linux

package workfolder

import (
	"os"
	"path/filepath"
	"syscall"
)

// lockGuides takes the work folder's guide lock, held across every write of
// the guides and every removal of a session folder, so the daemon and the
// host's CLI (two processes over one work folder) take turns. The kernel owns
// the lock, so a process that dies drops it. Without the lock file, nothing
// is locked: a guide is a convenience, never a reason to stop.
func (f *Folder) lockGuides() (unlock func()) {
	file, err := os.OpenFile(filepath.Join(f.layout.Root, LockFile), os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // a fixed name at the work folder's root
	if err != nil {
		return func() {}
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX); err != nil {
		_ = file.Close()
		return func() {}
	}
	return func() {
		_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
		_ = file.Close()
	}
}

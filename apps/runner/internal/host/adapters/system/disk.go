//go:build darwin || linux

package system

import (
	"os"
	"path/filepath"
	"syscall"
)

// DiskFree reports the free bytes available to this user on the filesystem
// holding path. A path that does not exist yet — the workspace directory on a
// host that has never run a session — resolves to its nearest existing
// ancestor, which is on the same filesystem in every case that matters.
func (p *Prober) DiskFree(path string) (uint64, error) {
	dir := filepath.Clean(path)
	for {
		if _, err := os.Stat(dir); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	var fs syscall.Statfs_t
	if err := syscall.Statfs(dir, &fs); err != nil {
		return 0, err
	}
	return uint64(fs.Bavail) * uint64(fs.Bsize), nil //nolint:gosec,unconvert // field widths differ between darwin and linux
}

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
	fs, err := statfs(path)
	if err != nil {
		return 0, err
	}
	return uint64(fs.Bavail) * uint64(fs.Bsize), nil //nolint:gosec,unconvert // field widths differ between darwin and linux
}

// DiskTotal reports the size of the filesystem holding path.
func (p *Prober) DiskTotal(path string) (uint64, error) {
	fs, err := statfs(path)
	if err != nil {
		return 0, err
	}
	return uint64(fs.Blocks) * uint64(fs.Bsize), nil //nolint:gosec,unconvert // field widths differ between darwin and linux
}

func statfs(path string) (syscall.Statfs_t, error) {
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
	err := syscall.Statfs(dir, &fs)
	return fs, err
}

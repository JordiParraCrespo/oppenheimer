//go:build darwin || linux

package cli

import (
	"os"
	"syscall"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// privateDirectory makes sure a directory the runner keeps secrets in is its
// own and nobody else's before anything secret is put there.
//
// The control socket hands out installation tokens, and between Listen and the
// Chmod after it the socket exists with the process umask's permissions. That
// window is harmless while its directory is 0700, because nobody else can
// traverse it; but MkdirAll does not tighten a directory that already exists,
// so one created looser (by hand, by an older version, restored from a backup)
// would stay looser. So: refuse a symlink or a directory another account owns,
// and tighten a loose mode to 0700. A umask set around Listen was considered
// and rejected: it is process-wide, and the session, update and link loops are
// already creating files by then.
func privateDirectory(path string) error {
	return privateDirectoryWith(path, os.Lstat, os.Getuid())
}

// privateDirectoryWith is privateDirectory with the stat and the uid supplied,
// so the ownership check can be tested without a second account.
func privateDirectoryWith(path string, lstat func(string) (os.FileInfo, error), uid int) error {
	info, err := lstat(path)
	if err != nil {
		return hostdomain.ErrRunnerDirectory.WithDetail("cannot inspect %s: %v", path, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return hostdomain.ErrRunnerDirectory.WithDetail("%s is a symlink; the runner keeps secrets only in a real directory it owns", path)
	}
	if !info.IsDir() {
		return hostdomain.ErrRunnerDirectory.WithDetail("%s is not a directory", path)
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || int(stat.Uid) != uid {
		return hostdomain.ErrRunnerDirectory.WithDetail("%s is not owned by this account (uid %d)", path, uid)
	}
	if info.Mode().Perm()&0o077 != 0 {
		if err := os.Chmod(path, 0o700); err != nil { //nolint:gosec // a directory: 0700 is the private mode, it must be traversable by its owner
			return hostdomain.ErrRunnerDirectory.WithDetail("cannot make %s private: %v", path, err)
		}
	}
	return nil
}

package binaries

import "golang.org/x/sys/unix"

// swap exchanges two paths in one rename (renameat2 with RENAME_EXCHANGE).
// Linux never runs a bundle; this is here so the macOS layout is tested
// where the tests run.
func swap(a, b string) error {
	return unix.Renameat2(unix.AT_FDCWD, a, unix.AT_FDCWD, b, unix.RENAME_EXCHANGE)
}

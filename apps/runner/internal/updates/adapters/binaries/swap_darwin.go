package binaries

import "golang.org/x/sys/unix"

// swap exchanges two paths in one rename (renamex_np with RENAME_SWAP).
func swap(a, b string) error { return unix.RenamexNp(a, b, unix.RENAME_SWAP) }

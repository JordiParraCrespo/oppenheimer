package domain

import (
	"errors"
	"sort"
	"strings"
)

// MaxFolderEntries is the most directories one listing names: the protocol's
// FS_LISTING_MAX_ENTRIES. A directory with more says it was cut short.
const MaxFolderEntries = 500

// ErrNotADirectory is a path with something other than a directory at it.
var ErrNotADirectory = errors.New("not a directory")

// FolderEntry is one directory in a listing: its name, and the branch its
// checkout is on when it is a git repository.
type FolderEntry struct {
	Name   string
	Branch string
}

// FolderListing is one directory's sub-directories, for the folder a person
// picks a folder session's folder in (24 §4): names only, never files and
// never what is in them.
type FolderListing struct {
	// Path is the directory listed, absolute and cleaned.
	Path string
	// Parent is its parent; empty at the root.
	Parent string
	// Home is the home directory of the account the runner runs as.
	Home string
	// Branch is the listed directory's own branch, when it is a repository.
	Branch    string
	Entries   []FolderEntry
	Truncated bool
}

// Listable keeps the names a listing shows: hidden ones (a leading dot) are
// left out, the rest sorted without regard to case, and no more than
// MaxFolderEntries of them. truncated says some were cut.
func Listable(names []string) (kept []string, truncated bool) {
	for _, name := range names {
		if name == "" || strings.HasPrefix(name, ".") {
			continue
		}
		kept = append(kept, name)
	}
	sort.Slice(kept, func(i, j int) bool {
		a, b := strings.ToLower(kept[i]), strings.ToLower(kept[j])
		if a != b {
			return a < b
		}
		return kept[i] < kept[j]
	})
	if len(kept) > MaxFolderEntries {
		return kept[:MaxFolderEntries], true
	}
	return kept, false
}

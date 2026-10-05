package cli

import (
	"os"
	"path/filepath"
	"runtime"
)

// IndexingOptOut is the marker macOS reads: a file by this name tells Spotlight
// to index nothing in the directory that holds it, or below it.
const IndexingOptOut = ".metadata_never_index"

// ExcludeFromIndexing asks the desktop search index to leave dir alone.
//
// Every session is a worktree with its dependencies installed, gigabytes of
// `node_modules` rewritten whenever an agent installs something. Indexing
// that (Spotlight's `mdworker_shared`) outspends the agents, pushes `tmux
// list-panes` past its deadline and the link past its pings, and the
// browser's terminals go blank.
//
// The marker is macOS's own unprivileged opt-out, an empty file the user can
// delete to get indexing back. Linux's indexers read their own configuration,
// so this is a no-op there. Failing to write it only leaves the host busier, so
// callers log and carry on.
//
// A root that does not exist yet is created (0700, as `ChooseWorkspaces` would)
// rather than skipped: the default root is otherwise first made by the first
// session's checkout, and every boot before that would find nowhere to put the
// marker while the worktrees went straight into the index (issue 221).
func ExcludeFromIndexing(dir string) error {
	return excludeFromIndexing(runtime.GOOS, dir)
}

func excludeFromIndexing(goos, dir string) error {
	if goos != "darwin" || dir == "" {
		return nil
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	marker := filepath.Join(dir, IndexingOptOut)
	if _, err := os.Stat(marker); err == nil {
		// Already opted out — and never rewritten, so a marker the user made
		// their own (some people put a note in it) is left as they left it.
		return nil
	}
	// #nosec G304 -- the path is this runner's own workspace root (the default,
	// or one ChooseWorkspaces resolved and checked), with a fixed basename appended;
	// nothing here is read, and O_EXCL is what keeps a marker someone wrote by
	// hand from being truncated by a boot that races the Stat above.
	file, err := os.OpenFile(marker, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		if os.IsExist(err) {
			return nil
		}
		return err
	}
	return file.Close()
}

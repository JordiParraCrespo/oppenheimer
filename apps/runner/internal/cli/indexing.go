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
// `node_modules` rewritten whenever an agent installs something. On a host with
// eight sessions Spotlight's `mdworker_shared` outspent the agents, `tmux
// list-panes` passed its ten-second deadline, the link missed its pings and the
// browser's terminals went blank.
//
// The marker is macOS's own unprivileged opt-out, an empty file the user can
// delete to get indexing back. Linux's indexers read their own configuration,
// so this is a no-op there. Failing to write it only leaves the host busier, so
// callers log and carry on.
func ExcludeFromIndexing(dir string) error {
	return excludeFromIndexing(runtime.GOOS, dir)
}

func excludeFromIndexing(goos, dir string) error {
	if goos != "darwin" || dir == "" {
		return nil
	}
	marker := filepath.Join(dir, IndexingOptOut)
	if _, err := os.Stat(marker); err == nil {
		// Already opted out — and never rewritten, so a marker the user made
		// their own (some people put a note in it) is left as they left it.
		return nil
	}
	// #nosec G304 -- the path is this runner's own workspace root, already
	// resolved and checked by ChooseWorkspaces, with a fixed basename appended;
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

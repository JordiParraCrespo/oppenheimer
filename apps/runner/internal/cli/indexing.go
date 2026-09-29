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
// A session is a git worktree with its dependencies installed, so a host
// running a handful of them holds several complete copies of a repository —
// on this monorepo, gigabytes across a few hundred `node_modules` directories,
// most of it rewritten whenever an agent installs something. Spotlight indexes
// all of it by default, and a host with eight sessions open spent more CPU in
// `mdworker_shared` than in the agents: enough that `tmux list-panes`, which
// answers in milliseconds on an idle host, passed its ten-second deadline and
// the control-plane link missed its pings. The terminals in the browser went
// blank while the machine indexed files nobody will ever search for.
//
// The marker is macOS's own opt-out and needs no privileges: an empty file the
// user can delete to get indexing back. Linux's indexers read their own
// configuration rather than a marker, so there is nothing to write there and
// this is a no-op — the workspace root is still the right place to say it, so
// a future indexer only needs a branch here.
//
// Failing to write it is never worth failing a command for: the host works,
// it is just busier than it needs to be, so callers log and carry on.
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

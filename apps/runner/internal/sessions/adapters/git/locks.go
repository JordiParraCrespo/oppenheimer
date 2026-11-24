package git

import "path/filepath"

// lockPath is the file a store's lock of kind is taken on, for every runner
// process on the host (packages/go/core/filelock): in the workspace's own
// `.oppenheimer/locks/`, so the store's directory need not exist yet and
// nothing is left among the stores. "store" serialises the work on the
// store; "deepen" is held by the background deepen while it fetches.
func lockPath(store, kind string) string {
	workspace := filepath.Dir(filepath.Dir(store))
	return filepath.Join(workspace, ".oppenheimer", "locks", filepath.Base(store)+"."+kind+".lock")
}

package git

// What an earlier attempt left at a worktree's path, and what Add does about
// it. A create can be cut short anywhere — a runner killed, a context ended —
// and the next attempt for the same session arrives at the same path, since
// the path is derived from the session id. Add inspects the path and then
// adopts, recreates, refuses, or finds it vacant.

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// lockInitializing is the reason git writes on a worktree it is adding and
// removes once the add has finished. Still there, the add was killed.
const lockInitializing = "initializing"

type pathKind int

const (
	// vacant: nothing at the path, nothing registered for it.
	vacant pathKind = iota
	// adopt: this session's worktree, registered on its branch, on disk.
	adopt
	// recreate: something to clear before a fresh add — a registration
	// whose directory is gone, or an empty directory git never registered.
	recreate
	// refuse: something that is not this session's to take over.
	refuse
)

// found is what inspect saw at a path.
type found struct {
	kind   pathKind
	record *worktreeRecord
	reason string
}

// worktreeRecord is one entry of `git worktree list --porcelain`.
type worktreeRecord struct {
	path       string
	branch     string
	locked     bool
	lockReason string
}

// inspect decides what is at path for a worktree on branch.
func (c *Client) inspect(ctx context.Context, mirror, path, branch string) (found, error) {
	record, err := c.recordAt(ctx, mirror, path)
	if err != nil {
		return found{}, err
	}
	_, statErr := os.Stat(path)
	onDisk := statErr == nil
	switch {
	case record != nil && record.branch != "refs/heads/"+branch:
		return found{kind: refuse, reason: path + " already exists, on " + describeBranch(record.branch)}, nil
	case record != nil && onDisk:
		return found{kind: adopt, record: record}, nil
	case record != nil:
		return found{kind: recreate, record: record}, nil
	case onDisk && isEmptyDir(path):
		return found{kind: recreate}, nil
	case onDisk:
		return found{kind: refuse, reason: path + " already exists"}, nil
	}
	return found{kind: vacant}, nil
}

// adopt takes over this session's worktree. One git still holds locked
// "initializing" was killed during `worktree add`, possibly before its
// checkout finished: the lock goes and the checkout is completed, which is
// exactly what the killed add would have done next.
func (c *Client) adopt(ctx context.Context, mirror, path string, at found) error {
	if !at.record.locked || at.record.lockReason != lockInitializing {
		return nil
	}
	if _, err := c.run(ctx, command{timeout: quickTimeout, dir: mirror}, "worktree", "unlock", path); err != nil {
		return err
	}
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: path}, "reset", "--hard", "--quiet")
	return err
}

// clear removes what is in the way of a fresh add: git's record of a
// directory that is gone (its lock first, since prune keeps locked ones), or
// an empty directory git never registered.
func (c *Client) clear(ctx context.Context, mirror, path string, at found) error {
	if at.record == nil {
		if err := os.Remove(path); err != nil {
			return domain.ErrWorktree.WithDetail("remove the empty %s: %v", path, err).WithCause(err)
		}
		return nil
	}
	quick := command{timeout: quickTimeout, dir: mirror}
	if at.record.locked {
		_, _ = c.run(ctx, quick, "worktree", "unlock", path)
	}
	_, err := c.run(ctx, quick, "worktree", "prune")
	return err
}

// leftoverBranch reports a branch an earlier attempt cut and then died before
// its worktree existed: it exists, is checked out nowhere, and holds nothing
// the start point does not — so resetting it to the start point loses nothing.
func (c *Client) leftoverBranch(ctx context.Context, mirror, branch, start string) bool {
	quick := command{timeout: quickTimeout, dir: mirror}
	ref := "refs/heads/" + branch
	if _, err := c.run(ctx, quick, "rev-parse", "--verify", "--quiet", ref); err != nil {
		return false
	}
	records, err := c.records(ctx, mirror)
	if err != nil {
		return false
	}
	for _, record := range records {
		if record.branch == ref {
			return false
		}
	}
	_, err = c.run(ctx, quick, "merge-base", "--is-ancestor", ref, start)
	return err == nil
}

// records lists what git has registered for the mirror.
func (c *Client) records(ctx context.Context, mirror string) ([]worktreeRecord, error) {
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: mirror}, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	return parseWorktreeList(out), nil
}

// parseWorktreeList reads `git worktree list --porcelain`: one block per
// worktree, blank-line separated, one attribute per line.
func parseWorktreeList(out string) []worktreeRecord {
	var records []worktreeRecord
	for _, block := range strings.Split(out, "\n\n") {
		var record worktreeRecord
		for _, line := range strings.Split(block, "\n") {
			key, value, _ := strings.Cut(strings.TrimSpace(line), " ")
			switch key {
			case "worktree":
				record.path = value
			case "branch":
				record.branch = value
			case "locked":
				record.locked, record.lockReason = true, value
			}
		}
		if record.path != "" {
			records = append(records, record)
		}
	}
	return records
}

// recordAt is git's record of the worktree at path, or nil.
func (c *Client) recordAt(ctx context.Context, mirror, path string) (*worktreeRecord, error) {
	records, err := c.records(ctx, mirror)
	if err != nil {
		return nil, err
	}
	want := canonical(path)
	for i := range records {
		if canonical(records[i].path) == want {
			return &records[i], nil
		}
	}
	return nil, nil
}

// canonical resolves symlinks in path's directory, which git has already
// done in what it reports (macOS's /var is /private/var). The last element
// is left as it is: the directory itself may be gone.
func canonical(path string) string {
	dir, base := filepath.Split(filepath.Clean(path))
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	return filepath.Join(dir, base)
}

func isEmptyDir(path string) bool {
	entries, err := os.ReadDir(path)
	return err == nil && len(entries) == 0
}

func describeBranch(ref string) string {
	if ref == "" {
		return "a detached HEAD"
	}
	return strings.TrimPrefix(ref, "refs/heads/")
}

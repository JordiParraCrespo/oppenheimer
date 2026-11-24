package git_test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Two runner processes over one work folder (the daemon and `runner
// sessions create` on the host, or two of those at once) each create
// sessions on the same repository at the same moment: the first clone, the
// fetches and the worktrees all succeed in both. Regresses if the store is
// only serialised inside one process: the two download it side by side, or
// one cuts a worktree while the other fetches, and git fails ("failed to
// read worktrees/…/commondir", "did not send all necessary objects").
func TestTwoProcessesCreateSessionsOnOneStoreAtOnce(t *testing.T) {
	remote := origin(t)
	layout := domain.Layout{Root: t.TempDir()}
	clients := []*gitadapter.Client{
		gitadapter.New(gitadapter.Options{Layout: layout}),
		gitadapter.New(gitadapter.Options{Layout: layout}),
	}
	for _, c := range clients {
		t.Cleanup(c.Wait)
	}

	const perClient = 6
	var wg sync.WaitGroup
	for n, c := range clients {
		for i := range perClient {
			wg.Go(func() {
				ctx := context.Background()
				slug := fmt.Sprintf("p%d-s%d", n, i)
				if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
					t.Errorf("%s: ensure: %v", slug, err)
					return
				}
				if err := c.Add(ctx, repo, checkout(layout, slug), "oppenheimer/"+slug, "main", true); err != nil {
					t.Errorf("%s: add: %v", slug, err)
				}
			})
		}
	}
	wg.Wait()

	for n := range clients {
		for i := range perClient {
			worktree := checkout(layout, fmt.Sprintf("p%d-s%d", n, i))
			if !clients[0].Exists(worktree) {
				t.Errorf("%s is not a worktree", worktree)
			}
		}
	}
}

// A spare this process made and holds as ready may since have been taken by
// another runner process, and a new one started at the same path that is
// still being checked out. The next create checks what is on disk before
// moving it into the session's folder. Regresses if it trusts its own
// memory: the session gets a worktree with its files missing.
func TestASpareHalfMadeByAnotherProcessIsNotTaken(t *testing.T) {
	remote := origin(t)
	c, layout := spareClient(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if err := c.Add(ctx, repo, checkout(layout, "one"), "oppenheimer/one", "main", true); err != nil {
		t.Fatalf("first add: %v", err)
	}
	c.Wait()
	// What another process's spare looks like part way through its
	// checkout: registered, on the base, its files not all written yet.
	if err := os.Remove(filepath.Join(spareOf(layout), "README.md")); err != nil {
		t.Fatal(err)
	}

	two := checkout(layout, "two")
	if err := c.Add(ctx, repo, two, "oppenheimer/two", "main", true); err != nil {
		t.Fatalf("second add: %v", err)
	}

	if _, err := os.Stat(filepath.Join(two, "README.md")); err != nil {
		t.Fatalf("the session's worktree is missing its files: %v", err)
	}
}

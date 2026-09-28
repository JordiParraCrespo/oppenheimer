package git_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// spareClient is a client that keeps spares, and waits for the one it is
// making before the test's directories go.
func spareClient(t *testing.T) (*gitadapter.Client, domain.Layout) {
	t.Helper()
	layout := domain.Layout{Root: t.TempDir()}
	c := gitadapter.New(gitadapter.Options{Layout: layout, Spares: true})
	t.Cleanup(c.Wait)
	return c, layout
}

func spareOf(layout domain.Layout) string {
	return filepath.Join(filepath.Dir(layout.Worktree(repo, "x")), ".spare")
}

func head(t *testing.T, dir, rev string) string {
	t.Helper()
	return strings.TrimSpace(git(t, dir, "rev-parse", rev))
}

func TestACreateLeavesASpareAndTheNextOneTakesItAtTheBaseAsItIsNow(t *testing.T) {
	remote := origin(t)
	c, layout := spareClient(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if err := c.Add(ctx, repo, layout.Worktree(repo, "one"), "oppenheimer/one", "main", true); err != nil {
		t.Fatalf("first add: %v", err)
	}
	c.Wait()
	spare := spareOf(layout)
	if _, err := os.Stat(filepath.Join(spare, "README.md")); err != nil {
		t.Fatalf("no spare was checked out after the first create: %v", err)
	}
	// Marks the spare, to see where it ends up.
	if err := os.WriteFile(filepath.Join(spare, "spare-marker"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	// The base moves on after the spare was made.
	advance(t, remote, "main")
	if err := c.Ensure(ctx, repo, "", "main"); err != nil {
		t.Fatal(err)
	}

	two := layout.Worktree(repo, "two")
	if err := c.Add(ctx, repo, two, "oppenheimer/two", "main", true); err != nil {
		t.Fatalf("second add: %v", err)
	}

	if _, err := os.Stat(filepath.Join(two, "spare-marker")); err != nil {
		t.Fatal("the second create did not take the spare")
	}
	if got := strings.TrimSpace(git(t, two, "rev-parse", "--abbrev-ref", "HEAD")); got != "oppenheimer/two" {
		t.Fatalf("branch = %q", got)
	}
	if got, want := head(t, two, "HEAD"), head(t, layout.Mirror(repo), "origin/main"); got != want {
		t.Fatalf("cut from %s, want the base as fetched, %s", got, want)
	}
	if out := git(t, two, "status", "--porcelain", "--untracked-files=no"); out != "" {
		t.Fatalf("the taken spare is not clean:\n%s", out)
	}
	c.Wait()
	if _, err := os.Stat(filepath.Join(spare, "README.md")); err != nil {
		t.Fatalf("the spare was not replaced after it was taken: %v", err)
	}
}

// A runner killed between moving the spare into place and checking out the
// session's branch leaves a detached worktree at the session's path; the next
// attempt finishes the claim instead of refusing the path.
func TestAClaimCutShortIsFinishedByTheNextAttempt(t *testing.T) {
	remote := origin(t)
	c, layout := spareClient(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if err := c.Add(ctx, repo, layout.Worktree(repo, "one"), "oppenheimer/one", "main", true); err != nil {
		t.Fatal(err)
	}
	c.Wait()
	two := layout.Worktree(repo, "two")
	git(t, layout.Mirror(repo), "worktree", "move", spareOf(layout), two)

	if err := c.Add(ctx, repo, two, "oppenheimer/two", "main", true); err != nil {
		t.Fatalf("add after a cut-short claim: %v", err)
	}

	if got := strings.TrimSpace(git(t, two, "rev-parse", "--abbrev-ref", "HEAD")); got != "oppenheimer/two" {
		t.Fatalf("branch = %q", got)
	}
}

// Something at the spare's path that git never registered is not the
// runner's to delete: it stays, and creates go on without a spare.
func TestSomethingUnknownAtTheSparePathIsLeftAlone(t *testing.T) {
	remote := origin(t)
	c, layout := spareClient(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	keep := filepath.Join(spareOf(layout), "keep.txt")
	if err := os.MkdirAll(filepath.Dir(keep), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keep, []byte("mine\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"one", "two"} {
		if err := c.Add(ctx, repo, layout.Worktree(repo, name), "oppenheimer/"+name, "main", true); err != nil {
			t.Fatalf("add %s: %v", name, err)
		}
		c.Wait()
	}

	if body, err := os.ReadFile(keep); err != nil || string(body) != "mine\n" {
		t.Fatalf("what was at the spare's path was touched: %q, %v", body, err)
	}
}

func TestSparesAreOffUnlessAskedFor(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if err := c.Add(ctx, repo, layout.Worktree(repo, "one"), "oppenheimer/one", "main", true); err != nil {
		t.Fatal(err)
	}
	c.Wait()

	if _, err := os.Stat(spareOf(layout)); !os.IsNotExist(err) {
		t.Fatalf("a spare was made: %v", err)
	}
}

// A spare outlives the runner that made it: a restarted runner, or a
// one-shot `runner sessions create`, takes the one on disk.
func TestASpareOnDiskIsTakenByANewRunner(t *testing.T) {
	remote := origin(t)
	first, layout := spareClient(t)
	ctx := context.Background()
	if err := first.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if err := first.Add(ctx, repo, layout.Worktree(repo, "one"), "oppenheimer/one", "main", true); err != nil {
		t.Fatal(err)
	}
	first.Wait()
	if err := os.WriteFile(filepath.Join(spareOf(layout), "spare-marker"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	second := gitadapter.New(gitadapter.Options{Layout: layout, Spares: true})
	t.Cleanup(second.Wait)

	two := layout.Worktree(repo, "two")
	if err := second.Add(ctx, repo, two, "oppenheimer/two", "main", true); err != nil {
		t.Fatalf("add: %v", err)
	}

	if _, err := os.Stat(filepath.Join(two, "spare-marker")); err != nil {
		t.Fatal("the new runner did not take the spare on disk")
	}
}

package git_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A session's worktree with one commit on its branch (an edit and a
// rename), an edit not committed yet, and an untracked file whose name has a
// space and an accent, cut from main.
func changedWorktree(t *testing.T) (string, string) {
	t.Helper()
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	worktree := checkout(layout, "session-changes")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/changes", "main", true); err != nil {
		t.Fatal(err)
	}
	git(t, worktree, "config", "user.email", "test@example.com")
	git(t, worktree, "config", "user.name", "Test")
	write(t, worktree, "README.md", "# seed\nmore\n")
	write(t, worktree, "notes.txt", "one\ntwo\nthree\nfour\nfive\n")
	git(t, worktree, "add", ".")
	git(t, worktree, "commit", "-q", "-m", "branch work")
	git(t, worktree, "mv", "notes.txt", "kept.txt")
	git(t, worktree, "commit", "-q", "-m", "rename")
	write(t, worktree, "kept.txt", "one\ntwo\nthree\nfour\nfive\nsix\n")
	write(t, worktree, "a new é.txt", "hola\nmundo")
	return remote, worktree
}

func write(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func byPath(files []domain.ChangedFile) map[string]domain.ChangedFile {
	out := map[string]domain.ChangedFile{}
	for _, f := range files {
		out[f.Path] = f
	}
	return out
}

// Since the branch left its base: the commits and the edits not committed
// yet, renames named as renames, untracked files counted from the file, and
// a commit the base gained afterwards not shown. The regression this guards:
// a read against the base's tip, which shows the base's new work reversed.
func TestChangesSinceTheBaseHoldTheCommitsTheEditsAndTheUntrackedFiles(t *testing.T) {
	remote, worktree := changedWorktree(t)
	c, _ := client(t)
	ctx := context.Background()
	advance(t, remote, "main")
	git(t, worktree, "fetch", "-q", "origin", "+refs/heads/main:refs/remotes/origin/main")

	changes, err := c.Changes(ctx, worktree, "main", false)
	if err != nil {
		t.Fatal(err)
	}
	if changes.Approximate || changes.Base == "" {
		t.Fatalf("base = %q approximate = %v; want the merge-base, exact", changes.Base, changes.Approximate)
	}
	if tip := strings.TrimSpace(git(t, worktree, "rev-parse", "origin/main")); changes.Base == tip {
		t.Fatal("compared with the base's tip, not where the branch left it")
	}
	files := byPath(changes.Files)
	if len(files) != 3 {
		t.Fatalf("files = %+v; want README.md, kept.txt and the untracked file", changes.Files)
	}
	if f := files["README.md"]; f.Status != domain.ChangeModified || f.Additions != 1 || f.Deletions != 0 {
		t.Errorf("README.md = %+v", f)
	}
	// notes.txt was added on the branch and renamed there: against the base it is new.
	if f := files["kept.txt"]; f.Status != domain.ChangeAdded || f.Additions != 6 {
		t.Errorf("kept.txt = %+v", f)
	}
	if f := files["a new é.txt"]; f.Status != domain.ChangeUntracked || f.Additions != 2 {
		t.Errorf("untracked = %+v", f)
	}
}

// Only what is not committed yet: the edit to a committed file and the
// untracked one, a rename committed before not among them.
func TestUncommittedChangesLeaveTheCommitsOut(t *testing.T) {
	_, worktree := changedWorktree(t)
	c, _ := client(t)
	changes, err := c.Changes(context.Background(), worktree, "main", true)
	if err != nil {
		t.Fatal(err)
	}
	head := strings.TrimSpace(git(t, worktree, "rev-parse", "HEAD"))
	if changes.Base != head || changes.Approximate {
		t.Fatalf("base = %q approximate = %v; want HEAD %q", changes.Base, changes.Approximate, head)
	}
	files := byPath(changes.Files)
	if len(files) != 2 {
		t.Fatalf("files = %+v; want kept.txt and the untracked file", changes.Files)
	}
	if f := files["kept.txt"]; f.Status != domain.ChangeModified || f.Additions != 1 || f.Deletions != 0 {
		t.Errorf("kept.txt = %+v", f)
	}
}

// A rename committed on the branch reads as one, with where it came from.
func TestARenameAgainstItsOwnPastReadsAsARename(t *testing.T) {
	_, worktree := changedWorktree(t)
	c, _ := client(t)
	git(t, worktree, "checkout", "-q", "--", "kept.txt")
	git(t, worktree, "mv", "kept.txt", "moved.txt")
	changes, err := c.Changes(context.Background(), worktree, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if f := byPath(changes.Files)["moved.txt"]; f.Status != domain.ChangeRenamed || f.OldPath != "kept.txt" {
		t.Fatalf("moved.txt = %+v; want a rename from kept.txt", f)
	}
}

// A patch is whole or absent: a file's diff from its `diff --git` line, an
// untracked file's made as git prints a new one, and one longer than the
// bound not returned at all rather than cut mid-hunk.
func TestAPatchIsWholeOrLeftOut(t *testing.T) {
	_, worktree := changedWorktree(t)
	c, _ := client(t)
	ctx := context.Background()
	changes, err := c.Changes(ctx, worktree, "main", false)
	if err != nil {
		t.Fatal(err)
	}
	files := byPath(changes.Files)

	patch, ok, err := c.Patch(ctx, worktree, changes.Base, files["README.md"], 64<<10)
	if err != nil || !ok {
		t.Fatalf("ok = %v, err = %v", ok, err)
	}
	if !strings.HasPrefix(patch, "diff --git a/README.md b/README.md\n") || !strings.Contains(patch, "\n+more\n") {
		t.Fatalf("patch = %q", patch)
	}

	untracked, ok, err := c.Patch(ctx, worktree, changes.Base, files["a new é.txt"], 64<<10)
	if err != nil || !ok {
		t.Fatalf("untracked ok = %v, err = %v", ok, err)
	}
	if !strings.Contains(untracked, "@@ -0,0 +1,2 @@\n+hola\n+mundo\n\\ No newline at end of file\n") {
		t.Fatalf("untracked patch = %q", untracked)
	}

	if _, ok, err := c.Patch(ctx, worktree, changes.Base, files["README.md"], 20); err != nil || ok {
		t.Fatalf("a patch past its bound: ok = %v, err = %v; want left out", ok, err)
	}
}

// An untracked symlink that points out of the checkout is listed, but
// neither counted nor read: a session's changes never show the host's files.
func TestAnUntrackedLinkOutOfTheCheckoutIsNeverRead(t *testing.T) {
	_, worktree := changedWorktree(t)
	c, _ := client(t)
	ctx := context.Background()
	secret := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(secret, []byte("token\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(secret, filepath.Join(worktree, "leak.txt")); err != nil {
		t.Fatal(err)
	}
	changes, err := c.Changes(ctx, worktree, "main", true)
	if err != nil {
		t.Fatal(err)
	}
	leak, listed := byPath(changes.Files)["leak.txt"]
	if !listed || leak.Additions != 0 {
		t.Fatalf("leak.txt = %+v, listed = %v; want listed, uncounted", leak, listed)
	}
	if patch, ok, _ := c.Patch(ctx, worktree, changes.Base, leak, 64<<10); ok || strings.Contains(patch, "token") {
		t.Fatalf("the link was read: %q", patch)
	}
}

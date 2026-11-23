package workfolder_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func read(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(data)
}

func detailed(layout domain.Layout, id, slug string) domain.SessionFolder {
	folder := session(layout, id, slug)
	folder.Name, folder.Agent, folder.Branch = "Fix the login redirect", domain.AgentClaude, "claude/fix-login"
	folder.Checkouts = []domain.FolderCheckout{{Repo: "acme/web", Directory: "web"}}
	return folder
}

// Every directory the runner makes in the work folder says what it is, in a
// README.md for the person and an AGENTS.md for an agent, so a workspace or a
// session folder can be found by its name although the folders are named by
// ids. Regresses if a level is skipped or the indexes lose a session's name,
// repository or branch.
func TestEveryLevelOfTheWorkFolderHasAGuideNamingWhatItHolds(t *testing.T) {
	f, layout := setup(t)
	folder := detailed(layout, "sess-1", "fix-login")
	if err := f.MakeSession(folder); err != nil {
		t.Fatalf("make: %v", err)
	}

	for _, dir := range []string{
		layout.Root, layout.Account("acct-1"), layout.Workspace(tenant),
		layout.Repos(tenant), layout.Sessions(tenant), folder.Dir,
	} {
		for _, name := range []string{"README.md", "AGENTS.md"} {
			if text := read(t, filepath.Join(dir, name)); !strings.HasPrefix(text, "<!-- Written by the Oppenheimer runner") {
				t.Fatalf("%s/%s does not say the runner wrote it:\n%s", dir, name, text)
			}
		}
	}
	root := read(t, filepath.Join(layout.Root, "README.md"))
	if !strings.Contains(root, "| acme | [`acct-1/ws-1/`](acct-1/ws-1/README.md) | 1 |") {
		t.Fatalf("the root README does not list the workspace by its name:\n%s", root)
	}
	ws := read(t, filepath.Join(layout.Workspace(tenant), "README.md"))
	for _, want := range []string{"Fix the login redirect", "acme/web", "`claude/fix-login`", "`claude`", "sessions.noindex/fix-login/README.md"} {
		if !strings.Contains(ws, want) {
			t.Fatalf("the workspace README lacks %q:\n%s", want, ws)
		}
	}
	agents := read(t, filepath.Join(folder.Dir, "AGENTS.md"))
	if !strings.Contains(agents, "`web/` (acme/web)") || !strings.Contains(agents, "repos.noindex/") {
		t.Fatalf("the session's AGENTS.md does not point at its checkout and the rules:\n%s", agents)
	}
}

// A closed session leaves the indexes, and the next one is added to them:
// the guides follow the folder. Regresses if they are written only once.
func TestTheGuidesFollowSessionsBeingMadeAndClosed(t *testing.T) {
	f, layout := setup(t)
	first, second := detailed(layout, "sess-1", "fix-login"), detailed(layout, "sess-2", "add-search")
	second.Name = "Add search"
	for _, folder := range []domain.SessionFolder{first, second} {
		if err := f.MakeSession(folder); err != nil {
			t.Fatalf("make: %v", err)
		}
	}
	if err := f.RemoveSession(first.Dir, "sess-1"); err != nil {
		t.Fatalf("remove: %v", err)
	}

	index := read(t, filepath.Join(layout.Sessions(tenant), "README.md"))
	if strings.Contains(index, "Fix the login redirect") || !strings.Contains(index, "Add search") {
		t.Fatalf("the sessions index does not follow the close:\n%s", index)
	}
	if root := read(t, filepath.Join(layout.Root, "README.md")); !strings.Contains(root, "| 1 |") {
		t.Fatalf("the root README still counts the closed session:\n%s", root)
	}
}

// A README.md the runner did not write, at the root of a work folder the
// person chose, and a checkout directory named like a guide are left as they
// are. Regresses if a guide is written over whatever is at its path.
func TestAGuideNeverReplacesWhatTheRunnerDidNotWrite(t *testing.T) {
	f, layout := setup(t)
	if err := f.Init(); err != nil {
		t.Fatal(err)
	}
	mine := filepath.Join(layout.Root, "README.md")
	if err := os.WriteFile(mine, []byte("my notes\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	folder := detailed(layout, "sess-1", "fix-login")
	folder.Checkouts = []domain.FolderCheckout{{Repo: "acme/docs", Directory: "AGENTS.md"}}
	if err := f.MakeSession(folder); err != nil {
		t.Fatalf("make: %v", err)
	}
	checkout := filepath.Join(folder.Dir, "AGENTS.md")
	if err := os.Remove(checkout); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(checkout, 0o700); err != nil {
		t.Fatal(err)
	}

	f.WriteGuides()

	if got := read(t, mine); got != "my notes\n" {
		t.Fatalf("the person's README.md was rewritten:\n%s", got)
	}
	if info, err := os.Stat(checkout); err != nil || !info.IsDir() {
		t.Fatalf("the checkout named AGENTS.md is gone: %v", err)
	}
}

// A work folder an older runner made, whose markers say nothing but kind and
// id, gets its guides when WriteGuides runs at start, its sessions listed by
// slug. Regresses if the guides need the new marker fields.
func TestAWorkFolderFromAnOlderRunnerGetsItsGuides(t *testing.T) {
	f, layout := setup(t)
	if err := f.MakeSession(session(layout, "sess-1", "fix-login")); err != nil {
		t.Fatalf("make: %v", err)
	}
	for _, dir := range []string{layout.Root, layout.Workspace(tenant), layout.Sessions(tenant)} {
		if err := os.Remove(filepath.Join(dir, "README.md")); err != nil {
			t.Fatal(err)
		}
	}

	f.WriteGuides()

	if index := read(t, filepath.Join(layout.Sessions(tenant), "README.md")); !strings.Contains(index, "| fix-login |") {
		t.Fatalf("the session is not listed by its slug:\n%s", index)
	}
}

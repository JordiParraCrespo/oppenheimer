package app_test

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// A session from the control plane lands in its account's and workspace's
// levels of the work folder, in a folder named by its slug, with the checkout
// named by the frame (24 §2); the folder is made, marker and all, before the
// terminal starts in it.
func TestAWorktreeSessionLivesInItsWorkspacesSessionsFolder(t *testing.T) {
	h := newFakeHarness(t)
	tenant := domain.Tenant{Account: "acct-1", Workspace: "ws-1"}

	session, err := h.svc.Create(context.Background(), app.CreateInput{
		ID: "sess1", Tenant: tenant, WorkspaceSlug: "acme", Slug: "fix-login", Directory: "web",
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git", BaseBranch: "main",
		Agent: domain.AgentClaude, GithubRepoID: 42,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	wantDir := "/home/jordi/oppenheimer/acct-1/ws-1/sessions.noindex/fix-login"
	if session.Place != domain.PlaceWorktree || session.Dir != wantDir || session.Worktree != filepath.Join(wantDir, "web") {
		t.Fatalf("session = place %q dir %q worktree %q", session.Place, session.Dir, session.Worktree)
	}
	if session.AccountID != "acct-1" || session.WorkspaceID != "ws-1" {
		t.Fatalf("tenant = %q/%q", session.AccountID, session.WorkspaceID)
	}
	if h.places.Sessions[wantDir] != "sess1" || h.places.Slugs[wantDir] != "acme" {
		t.Fatalf("the session's folder was not made for it: %v %v", h.places.Sessions, h.places.Slugs)
	}
	if h.worktrees.Stores["acct-1/ws-1/jordi/oppenheimer"] != 1 {
		t.Fatalf("the store was not the workspace's: %v", h.worktrees.Stores)
	}
	if launched := h.terminals.Launches[session.Target(0)]; launched.Dir != session.Worktree {
		t.Fatalf("the agent started in %q, want the checkout", launched.Dir)
	}
}

// Every name the frame carries is joined into a path the runner may later
// delete; one that could leave its parent is refused before anything is made.
func TestACreateWhoseNamesWouldLeaveTheWorkFolderIsRefused(t *testing.T) {
	for name, edit := range map[string]func(*app.CreateInput){
		"account":   func(in *app.CreateInput) { in.Tenant = domain.Tenant{Account: "..", Workspace: "ws"} },
		"workspace": func(in *app.CreateInput) { in.Tenant = domain.Tenant{Account: "a", Workspace: "../../x"} },
		"slug":      func(in *app.CreateInput) { in.Slug = "../other" },
		"directory": func(in *app.CreateInput) { in.Directory = "a/b" },
	} {
		t.Run(name, func(t *testing.T) {
			h := newFakeHarness(t)
			in := app.CreateInput{Repo: "jordi/oppenheimer", Remote: "https://github.test/x.git", Agent: domain.AgentShell}
			edit(&in)

			_, err := h.svc.Create(context.Background(), in)

			var prob *problem.Error
			if !errors.As(err, &prob) || prob.Code != domain.ErrInvalidInput.Code {
				t.Fatalf("err = %v, want %s", err, domain.ErrInvalidInput.Code)
			}
			if len(h.places.Sessions) != 0 || len(h.worktrees.Stores) != 0 {
				t.Fatal("something was made for a refused create")
			}
		})
	}
}

// Closing a worktree session takes its folder with its worktree; one that
// keeps the worktree (unpushed work) keeps the folder too.
func TestClosingAWorktreeSessionRemovesItsFolder(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	h.worktrees.DirtyPaths[session.Worktree] = true

	if _, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true}); err == nil {
		t.Fatal("a dirty worktree was closed without being forced")
	}
	if !h.places.Has(session.Dir) {
		t.Fatal("the folder went while its worktree was kept")
	}

	if _, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true, Force: true}); err != nil {
		t.Fatalf("close: %v", err)
	}
	if h.places.Has(session.Dir) || !slices.Equal(h.places.Removed, []string{session.Dir}) {
		t.Fatalf("removed %v, want the session's folder", h.places.Removed)
	}
}

func openFolder(t *testing.T, h *fakeHarness, folder string) domain.Session {
	t.Helper()
	h.places.SetFolder(folder, true)
	var stages []string
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Folder: folder, Agent: domain.AgentClaude,
		Progress: func(ev domain.StageEvent) {
			if ev.Done {
				stages = append(stages, string(ev.Stage))
			}
		},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// A folder session has nothing to clone and nothing to cut.
	if strings.Join(stages, " ") != "terminal agent" {
		t.Fatalf("stages = %v, want terminal and agent only", stages)
	}
	return session
}

// A folder session (24 §3) runs in the person's folder: the terminal and the
// agent start there, nothing is fetched or cut, no session folder is made,
// and its git is left to the person's own credentials.
func TestAFolderSessionStartsInTheFolderAndMakesNothing(t *testing.T) {
	h := newFakeHarness(t)

	session := openFolder(t, h, "/home/jordi/code/site")

	if session.Place != domain.PlaceFolder || session.Folder != "/home/jordi/code/site" {
		t.Fatalf("session = %+v", session)
	}
	if session.Repo != "" || session.Branch != "" || session.Worktree != "" || session.Dir != "" {
		t.Fatalf("a folder session carries a checkout: %+v", session)
	}
	if session.Name != "site" {
		t.Fatalf("name = %q, want the folder's", session.Name)
	}
	if dir := h.terminals.Dir(session.TmuxName()); dir != session.Folder {
		t.Fatalf("the terminal started in %q", dir)
	}
	if launched := h.terminals.Launches[session.Target(0)]; launched.Dir != session.Folder || launched.Command == "" {
		t.Fatalf("the agent was launched %+v", launched)
	}
	if len(h.worktrees.Mirrors) != 0 || len(h.worktrees.Paths) != 0 || len(h.places.Sessions) != 0 {
		t.Fatal("a folder session made something")
	}
}

// Closing a folder session ends its terminal and touches nothing on disk:
// nothing is checked, pushed or removed, whatever the close asked for.
func TestClosingAFolderSessionLeavesTheFolderAlone(t *testing.T) {
	h := newFakeHarness(t)
	session := openFolder(t, h, "/home/jordi/code/site")

	closed, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true, Force: true})
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if closed.State != domain.StateClosed {
		t.Fatalf("state = %q", closed.State)
	}
	if has, _ := h.terminals.Has(context.Background(), session.TmuxName()); has {
		t.Fatal("the terminal outlived the close")
	}
	if len(h.worktrees.Pushed) != 0 || len(h.places.Removed) != 0 {
		t.Fatalf("closing a folder session pushed %v and removed %v", h.worktrees.Pushed, h.places.Removed)
	}
	if err := h.places.CheckFolder(session.Folder); err != nil {
		t.Fatalf("the folder is gone: %v", err)
	}
}

// A folder that went away, or never was a directory, refuses the create with
// a code of its own before a terminal is made.
func TestAFolderSessionNeedsAnExistingDirectory(t *testing.T) {
	for _, tc := range []struct {
		name string
		set  func(*fakeHarness)
		path string
		code string
	}{
		{"missing", func(*fakeHarness) {}, "/home/jordi/gone", domain.ErrFolderMissing.Code},
		{"a file", func(h *fakeHarness) { h.places.SetFolder("/home/jordi/notes.txt", false) }, "/home/jordi/notes.txt", domain.ErrFolderNotDirectory.Code},
		{"relative", func(*fakeHarness) {}, "code/site", domain.ErrInvalidInput.Code},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newFakeHarness(t)
			tc.set(h)

			_, err := h.svc.Create(context.Background(), app.CreateInput{Folder: tc.path, Agent: domain.AgentShell})

			var prob *problem.Error
			if !errors.As(err, &prob) || prob.Code != tc.code {
				t.Fatalf("err = %v, want %s", err, tc.code)
			}
			if names, _ := h.terminals.List(context.Background()); len(names) != 0 {
				t.Fatalf("a terminal was made: %v", names)
			}
		})
	}
}

// A folder session restarts where it ran; one whose folder was deleted on
// the host is closed instead, as a worktree session whose worktree went is.
func TestAFolderSessionRestartsInItsFolderUntilTheFolderGoes(t *testing.T) {
	h := newFakeHarness(t)
	ctx := context.Background()
	session := openFolder(t, h, "/home/jordi/code/site")
	if _, err := h.svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}

	restarted, err := h.svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatalf("restart: %v", err)
	}
	if dir := h.terminals.Dir(restarted.TmuxName()); dir != session.Folder {
		t.Fatalf("restarted in %q", dir)
	}
	if _, err := h.svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}

	h.places.DeleteFolder(session.Folder)
	_, err = h.svc.Restart(ctx, session.ID)

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != domain.ErrNotRunning.Code {
		t.Fatalf("err = %v, want %s", err, domain.ErrNotRunning.Code)
	}
	if got, _ := h.svc.Get(session.ID); got.State != domain.StateClosed {
		t.Fatalf("state = %q, want closed", got.State)
	}
}

// A record from the work folder's first layout has no place; this runner does
// not read that layout (24: no migration), so the record is not taken up.
func TestARecordFromTheFirstLayoutIsIgnored(t *testing.T) {
	store := &memoryStore{sessions: []domain.Session{
		{ID: "old", State: domain.StateIdle, Repo: "jordi/oppenheimer", Worktree: "/home/jordi/oppenheimer-ai/workspaces/jordi/oppenheimer/.worktrees/x"},
		{ID: "new", Place: domain.PlaceFolder, Folder: "/home/jordi/code", State: domain.StateStopped},
	}}
	svc, err := app.New(app.Options{Store: store})
	if err != nil {
		t.Fatal(err)
	}
	if got := svc.List(); len(got) != 1 || got[0].ID != "new" {
		t.Fatalf("sessions = %+v, want only the one with a place", got)
	}
}

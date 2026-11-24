package workfolder_test

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/workfolder"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func folderFor(layout domain.Layout, t domain.Tenant, id string) domain.SessionFolder {
	return domain.SessionFolder{
		Dir: layout.Session(t, id), SessionID: id, Tenant: t, WorkspaceSlug: "slug-" + t.Workspace,
		Created: time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC),
		Name:    "Session " + id, Agent: domain.AgentClaude, Branch: "claude/" + id,
		Checkouts: []domain.FolderCheckout{{Repo: "acme/web", Directory: "web"}},
	}
}

func tenantOf(account, workspace int) domain.Tenant {
	return domain.Tenant{Account: fmt.Sprintf("acct-%d", account), Workspace: fmt.Sprintf("ws-%d", workspace)}
}

// Sessions made and closed at once, across accounts and workspaces, on two
// Folders over the same root (the daemon and the host's CLI are two
// processes), leave every close done and every index naming exactly the
// sessions still open. Regresses if a guide written into a folder being
// removed makes the removal fail, or an index is left behind a change.
func TestGuidesStayRightUnderConcurrentCreatesAndClosesFromTwoProcesses(t *testing.T) {
	layout := domain.Layout{Root: filepath.Join(t.TempDir(), "oppenheimer")}
	daemon := workfolder.New(workfolder.Options{Layout: layout})
	cli := workfolder.New(workfolder.Options{Layout: layout})

	const accounts, workspaces, perWorkspace = 3, 3, 12
	var wg sync.WaitGroup
	errs := make(chan error, accounts*workspaces*perWorkspace*2)
	for a := range accounts {
		for w := range workspaces {
			tenant := tenantOf(a, w)
			for i := range perWorkspace {
				wg.Go(func() {
					f := daemon
					if i%2 == 1 {
						f = cli
					}
					id := fmt.Sprintf("s-%d-%d-%d", a, w, i)
					folder := folderFor(layout, tenant, id)
					if err := f.MakeSession(folder); err != nil {
						errs <- fmt.Errorf("make %s: %w", id, err)
						return
					}
					// Something in the checkout, as a worktree would hold.
					_ = os.MkdirAll(filepath.Join(folder.Dir, "web", "node_modules", "x"), 0o700)
					_ = os.WriteFile(filepath.Join(folder.Dir, "web", "node_modules", "x", "index.js"), []byte("x"), 0o600)
					if i%3 == 0 {
						if err := f.RemoveSession(folder.Dir, id); err != nil {
							errs <- fmt.Errorf("remove %s: %w", id, err)
						}
					}
				})
			}
		}
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}

	for a := range accounts {
		for w := range workspaces {
			tenant := tenantOf(a, w)
			index := read(t, filepath.Join(layout.Sessions(tenant), "README.md"))
			for i := range perWorkspace {
				id := fmt.Sprintf("s-%d-%d-%d", a, w, i)
				_, statErr := os.Stat(layout.Session(tenant, id))
				open, listed := i%3 != 0, strings.Contains(index, "| Session "+id+" |")
				if open != listed || open != (statErr == nil) {
					t.Errorf("%s: open %v, on disk %v, listed %v", id, open, statErr == nil, listed)
				}
			}
		}
	}
	root := read(t, filepath.Join(layout.Root, "README.md"))
	if got := strings.Count(root, "| 8 |"); got != accounts*workspaces {
		t.Errorf("the root README counts 8 open sessions for %d workspaces, want %d:\n%s", got, accounts*workspaces, root)
	}
	_ = filepath.WalkDir(layout.Root, func(path string, d os.DirEntry, err error) error {
		if err == nil && strings.Contains(d.Name(), ".md-") {
			t.Errorf("a guide's temporary file was left behind: %s", path)
		}
		return nil
	})
}

// A close deletes a session folder while another process writes the guides
// over and over, as the host's CLI does beside the daemon. Regresses if a
// guide lands in the folder while it is being emptied: the removal fails
// with "directory not empty" and leaves a folder whose marker is gone, which
// no runner would ever delete.
func TestACloseSurvivesGuidesBeingWrittenByAnotherProcess(t *testing.T) {
	layout := domain.Layout{Root: filepath.Join(t.TempDir(), "oppenheimer")}
	daemon := workfolder.New(workfolder.Options{Layout: layout})
	cli := workfolder.New(workfolder.Options{Layout: layout})
	tenant := tenantOf(0, 0)
	var folders []domain.SessionFolder
	for i := range 40 {
		folder := folderFor(layout, tenant, fmt.Sprintf("s-%d", i))
		if err := daemon.MakeSession(folder); err != nil {
			t.Fatal(err)
		}
		for j := range 200 {
			dir := filepath.Join(folder.Dir, "web", fmt.Sprintf("d%d", j%10))
			_ = os.MkdirAll(dir, 0o700)
			_ = os.WriteFile(filepath.Join(dir, fmt.Sprint(j)), nil, 0o600)
		}
		folders = append(folders, folder)
	}

	stop, done := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(done)
		for {
			select {
			case <-stop:
				return
			default:
				cli.WriteGuides()
			}
		}
	}()
	for _, folder := range folders {
		if err := daemon.RemoveSession(folder.Dir, folder.SessionID); err != nil {
			t.Errorf("close %s: %v", folder.SessionID, err)
		}
	}
	close(stop)
	<-done

	if left := subdirsOf(t, layout.Sessions(tenant)); len(left) > 0 {
		t.Fatalf("session folders left behind: %v", left)
	}
}

// A removal whose process died half way, a renamed folder nothing touches,
// is finished when the guides are next written in full, at start; one still
// being emptied is left to the process emptying it.
func TestAnAbandonedRemovalIsFinishedAtStart(t *testing.T) {
	now := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	layout := domain.Layout{Root: filepath.Join(t.TempDir(), "oppenheimer")}
	f := workfolder.New(workfolder.Options{Layout: layout, Now: func() time.Time { return now }})
	tenant := tenantOf(0, 0)
	if err := f.MakeWorkspace(tenant, "acme"); err != nil {
		t.Fatal(err)
	}
	old := filepath.Join(layout.Sessions(tenant), ".removing-s-1-1")
	fresh := filepath.Join(layout.Sessions(tenant), ".removing-s-2-2")
	for _, dir := range []string{old, fresh} {
		if err := os.MkdirAll(filepath.Join(dir, "web"), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.Chtimes(old, now.Add(-time.Hour), now.Add(-time.Hour))
	_ = os.Chtimes(fresh, now.Add(-time.Minute), now.Add(-time.Minute))

	f.WriteGuides()

	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Fatalf("the abandoned removal is still there: %v", err)
	}
	if _, err := os.Stat(fresh); err != nil {
		t.Fatalf("a removal in progress was taken over: %v", err)
	}
}

func subdirsOf(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() {
			names = append(names, entry.Name())
		}
	}
	return names
}

// What one create costs in a work folder that already holds many sessions.
// A create only rewrites the guides its change touches, so the cost tracks
// the workspace it is in, not the whole host.
func BenchmarkMakeSessionInABusyWorkFolder(b *testing.B) {
	for _, size := range []struct{ accounts, workspaces, sessions int }{
		{1, 1, 10}, {1, 1, 100}, {1, 1, 1000}, {4, 5, 50},
	} {
		b.Run(fmt.Sprintf("%dx%dx%d", size.accounts, size.workspaces, size.sessions), func(b *testing.B) {
			layout := domain.Layout{Root: filepath.Join(b.TempDir(), "oppenheimer")}
			f := workfolder.New(workfolder.Options{Layout: layout})
			for a := range size.accounts {
				for w := range size.workspaces {
					for i := range size.sessions {
						if err := f.MakeSession(folderFor(layout, tenantOf(a, w), fmt.Sprintf("s-%d", i))); err != nil {
							b.Fatal(err)
						}
					}
				}
			}
			tenant := tenantOf(0, 0)
			b.ResetTimer()
			for i := range b.N {
				id := fmt.Sprintf("bench-%d", i)
				folder := folderFor(layout, tenant, id)
				if err := f.MakeSession(folder); err != nil {
					b.Fatal(err)
				}
				if err := f.RemoveSession(folder.Dir, id); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

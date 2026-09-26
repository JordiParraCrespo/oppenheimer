package app_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// gatedGit is git whose clone waits to be released and then answers err.
type gatedGit struct {
	*fake.Worktrees
	release chan struct{}
	err     error
	mu      sync.Mutex
	clones  []string // the session each clone ran for
}

func (g *gatedGit) Ensure(ctx context.Context, repo, remote string) error {
	g.mu.Lock()
	g.clones = append(g.clones, domain.SessionOf(ctx))
	g.mu.Unlock()
	<-g.release
	if g.err != nil {
		return g.err
	}
	return g.Worktrees.Ensure(ctx, repo, remote)
}

func gatedService(t *testing.T, err error) (*app.Service, *gatedGit, *memoryStore) {
	t.Helper()
	git := &gatedGit{Worktrees: fake.NewWorktrees(), release: make(chan struct{}), err: err}
	store := &memoryStore{}
	svc, newErr := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: git, Classifier: manifest.New(manifest.Options{}),
		Store: store, Layout: domain.Layout{Root: "/home/jordi/oppenheimer-ai/workspaces"},
	})
	if newErr != nil {
		t.Fatal(newErr)
	}
	return svc, git, store
}

const creatingID = "2ec946ef-7204-46ce-a722-6fa5904b371e"

func createInput() app.CreateInput {
	return app.CreateInput{
		ID: creatingID, Repo: "acme-labs/xrp-mobile", Remote: "https://github.com/acme-labs/xrp-mobile.git",
		BaseBranch: "main", Agent: domain.AgentClaude, CheckoutID: "c-1", GithubRepoID: 42,
	}
}

func waitCreating(t *testing.T, svc *app.Service) domain.Session {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if session, err := svc.Get(creatingID); err == nil {
			return session
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("the session never appeared while it was being created")
	return domain.Session{}
}

// While its clone runs, a session is there to be asked about — by the
// credential helper its own clone calls — but not to act on, not listed and
// not saved. A second create for it joins the first rather than cloning again.
func TestASessionBeingCreatedIsKnownAndASecondCreateJoinsIt(t *testing.T) {
	svc, git, store := gatedService(t, nil)
	type outcome struct {
		session domain.Session
		err     error
	}
	results := make(chan outcome, 2)
	create := func() {
		session, err := svc.Create(context.Background(), createInput())
		results <- outcome{session, err}
	}

	go create()
	creating := waitCreating(t, svc)
	go create()

	if creating.State != domain.StateCreating || creating.CheckoutID != "c-1" || creating.GithubRepoID != 42 {
		t.Fatalf("a session in creation reads %+v", creating)
	}
	if len(svc.List()) != 0 || len(store.sessions) != 0 {
		t.Fatal("a session in creation is listed or saved")
	}
	if _, err := svc.Stop(context.Background(), creatingID); err == nil {
		t.Fatal("a session in creation has nothing to stop yet; the stop must be refused")
	}
	close(git.release)

	first, second := <-results, <-results
	if first.err != nil || second.err != nil || first.session.ID != second.session.ID {
		t.Fatalf("creates = %+v, %+v; want the same session twice", first, second)
	}
	if len(git.clones) != 1 || git.clones[0] != creatingID {
		t.Fatalf("clones ran for %v; want one, for the session", git.clones)
	}
	if got, _ := svc.Get(creatingID); got.State != domain.StateStarting {
		t.Fatalf("after the create, the session is %s", got.State)
	}
}

// A create that fails leaves nothing claiming the session, so the next
// attempt starts afresh — and is told the same failure while it waited.
func TestAFailedCreateLeavesNoRecord(t *testing.T) {
	refused := domain.ErrGitCredential.WithDetail("no token")
	svc, git, store := gatedService(t, refused)

	done := make(chan error, 1)
	go func() {
		_, err := svc.Create(context.Background(), createInput())
		done <- err
	}()
	waitCreating(t, svc)
	close(git.release)

	if err := <-done; !errors.Is(err, refused) {
		t.Fatalf("err = %v, want the clone's refusal", err)
	}
	if _, err := svc.Get(creatingID); err == nil {
		t.Fatal("a failed create left a session behind")
	}
	if len(store.sessions) != 0 {
		t.Fatal("a failed create was saved")
	}
}

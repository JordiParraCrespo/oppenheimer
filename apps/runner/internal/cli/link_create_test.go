package cli

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// heldClone is git whose clone waits to be released, and fails if the
// context it runs on ended first — as a real clone killed with its context
// does.
type heldClone struct {
	*fake.Worktrees
	release chan struct{}
	mu      sync.Mutex
	clones  int
	forID   []string
}

func (h *heldClone) Ensure(ctx context.Context, repo, remote string) error {
	h.mu.Lock()
	h.clones++
	h.forID = append(h.forID, sessionsdomain.SessionOf(ctx))
	h.mu.Unlock()
	<-h.release
	if err := ctx.Err(); err != nil {
		return sessionsdomain.ErrGitAbandoned.WithCause(err)
	}
	return h.Worktrees.Ensure(ctx, repo, remote)
}

func newCreateHarness(t *testing.T) (*linkHandler, *sessionsapp.Service, *heldClone, *fake.Terminals) {
	t.Helper()
	terminals := fake.NewTerminals()
	git := &heldClone{Worktrees: fake.NewWorktrees(), release: make(chan struct{})}
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: git, Classifier: manifest.New(manifest.Options{}),
		Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := &linkHandler{
		app: &App{Sessions: svc}, logger: logger,
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	// Never run: every send is ErrNotConnected, which is what a dropped link
	// looks like to the handler.
	client, err := link.New(link.Options{
		ControlPlaneURL: "http://127.0.0.1:1", Handler: h, Logger: logger,
		Token: func(context.Context) (string, error) { return "", nil },
	})
	if err != nil {
		t.Fatal(err)
	}
	h.client, h.reporter = client, link.NewReporter("run-test", client, logger)
	return h, svc, git, terminals
}

func message(t *testing.T, kind string, body map[string]any) link.Message {
	t.Helper()
	body["type"] = kind
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return link.Message{Type: kind, Raw: raw}
}

const sessionUnderTest = "2ec946ef-7204-46ce-a722-6fa5904b371e"

func createMessage(t *testing.T, commandID string) link.Message {
	return message(t, "session.create", map[string]any{
		"commandId": commandID, "sessionId": sessionUnderTest, "agent": "claude-code",
		"sessionSlug": "bright-lark", "checkouts": []map[string]any{{
			"checkoutId": "c-1", "githubRepoId": 42, "repositoryFullName": "acme-labs/xrp-mobile", "baseBranch": "main",
		}},
	})
}

func waitForState(t *testing.T, svc *sessionsapp.Service, want sessionsdomain.State) sessionsdomain.Session {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		session, err := svc.Get(sessionUnderTest)
		if err == nil && session.State == want {
			return session
		}
		if time.Now().After(deadline) {
			t.Fatalf("session is %+v (err %v), want %s", session.State, err, want)
		}
		time.Sleep(time.Millisecond)
	}
}

// The #79 path: the link drops while a create is cloning, the control plane
// redelivers the create, and the user's stop was already on its way. The
// clone is not killed with the link, the redelivery does not clone again,
// and the stop runs — on the daemon's context — once the session exists.
func TestACreateOutlivesItsLinkAndWhatWaitedOnItRunsAfter(t *testing.T) {
	h, svc, git, terminals := newCreateHarness(t)
	linkCtx, dropLink := context.WithCancel(context.Background())

	h.Message(linkCtx, createMessage(t, "11111111-1111-4111-8111-111111111111"))
	// While it clones, the session is there to be asked about — which is
	// what the credential helper its clone calls does.
	creating := waitForState(t, svc, sessionsdomain.StateCreating)
	if creating.CheckoutID != "c-1" || creating.GithubRepoID != 42 {
		t.Fatalf("a session in creation names checkout %q/%d", creating.CheckoutID, creating.GithubRepoID)
	}
	dropLink()
	h.Message(linkCtx, createMessage(t, "22222222-2222-4222-8222-222222222222"))
	h.Message(linkCtx, message(t, "session.stop", map[string]any{
		"commandId": "33333333-3333-4333-8333-333333333333", "sessionId": sessionUnderTest,
	}))
	close(git.release)

	waitForState(t, svc, sessionsdomain.StateStopped)
	git.mu.Lock()
	defer git.mu.Unlock()
	if git.clones != 1 {
		t.Fatalf("cloned %d times; the redelivered create must find the session the first one made", git.clones)
	}
	if git.forID[0] != sessionUnderTest {
		t.Fatalf("the clone ran for session %q, want %q", git.forID[0], sessionUnderTest)
	}
	if names, _ := terminals.List(context.Background()); len(names) != 0 {
		t.Fatalf("the stop did not end the tmux session: %v", names)
	}
}

package cli_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/cli"
	pairapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	svcapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	svcdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// identityStore is the pairing store in memory, counting how often the
// identity was erased.
type identityStore struct {
	identity pairdomain.Identity
	cleared  int
}

func (s *identityStore) Load() (pairdomain.Identity, ed25519.PrivateKey, error) {
	if s.cleared > 0 {
		return pairdomain.Identity{}, nil, pairdomain.ErrNotPaired
	}
	return s.identity, nil, nil
}
func (s *identityStore) Save(i pairdomain.Identity, _ ed25519.PrivateKey) error {
	s.identity = i
	return nil
}
func (s *identityStore) SaveIdentity(i pairdomain.Identity) error {
	s.identity = i
	return nil
}
func (s *identityStore) Clear() error {
	s.cleared++
	return nil
}

// offlineSigner cannot sign, so the control plane is never told: the
// unreachable case, without a network.
type offlineSigner struct{}

func (offlineSigner) Sign(ed25519.PrivateKey, pairdomain.BootClaims) (string, error) {
	return "", errors.New("offline")
}

// quietManager is a service manager with nothing installed.
type quietManager struct{}

func (quietManager) Kind() svcdomain.Kind                             { return svcdomain.KindSystemd }
func (quietManager) Install(context.Context, svcdomain.Unit) error    { return nil }
func (quietManager) Uninstall(context.Context) error                  { return nil }
func (quietManager) Restart(context.Context) error                    { return nil }
func (quietManager) Status(context.Context) (svcdomain.Status, error) { return svcdomain.Status{}, nil }
func (quietManager) Path() string                                     { return "" }

// stubbornTerminals is tmux refusing to kill anything.
type stubbornTerminals struct{ *fake.Terminals }

func (stubbornTerminals) Kill(context.Context, string) error {
	return errors.New("tmux: permission denied")
}

type sessionStore struct{ sessions []sessionsdomain.Session }

func (m *sessionStore) Load() ([]sessionsdomain.Session, error) { return m.sessions, nil }
func (m *sessionStore) Save(sessions []sessionsdomain.Session) error {
	m.sessions = sessions
	return nil
}

func hostApp(t *testing.T, terminals sessionsapp.Terminals, worktrees *fake.Worktrees) (*cli.App, *identityStore) {
	t.Helper()
	root := t.TempDir()
	workspaces := filepath.Join(root, "workspaces")
	store := &identityStore{identity: pairdomain.Identity{
		HostID: "host-1", Name: "Dev box", ControlPlaneURL: "https://cp.example.test",
		Channel: pairdomain.ChannelStable,
	}}
	sessions, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: worktrees, Classifier: manifest.New(manifest.Options{}),
		Store: &sessionStore{}, Layout: sessionsdomain.Layout{Root: workspaces},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &cli.App{
		Paths: cli.Paths{
			Home: filepath.Join(root, ".oppenheimer"), UserHome: root,
			Workspaces: workspaces, WorkspacesSource: "default",
		},
		Pairing:  pairapp.New(pairapp.Options{Store: store, Signer: offlineSigner{}}),
		Service:  svcapp.New(svcapp.Options{Manager: quietManager{}}),
		Sessions: sessions,
	}, store
}

func openSession(t *testing.T, app *cli.App) sessionsdomain.Session {
	t.Helper()
	session, err := app.Sessions.Create(context.Background(), sessionsapp.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: sessionsdomain.AgentClaude,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

func TestUninstallKeepsThePairingWhenASessionCannotBeEnded(t *testing.T) {
	app, store := hostApp(t, stubbornTerminals{fake.NewTerminals()}, fake.NewWorktrees())
	openSession(t, app)

	var out bytes.Buffer
	err := app.Uninstall(context.Background(), &out, cli.UninstallOptions{Force: true})

	// An agent that is still running must not be left with no control plane:
	// the identity stays, so the host stays visible and a re-run can finish.
	if err == nil {
		t.Fatal("uninstall must fail when a session could not be ended")
	}
	if store.cleared != 0 {
		t.Fatal("the identity was erased while a session was still running")
	}
	if !strings.Contains(out.String(), "still paired") {
		t.Fatalf("output does not say the host is still paired:\n%s", out.String())
	}
}

func TestUninstallEndsSessionsThenErasesTheIdentity(t *testing.T) {
	app, store := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
	openSession(t, app)

	var out bytes.Buffer
	if err := app.Uninstall(context.Background(), &out, cli.UninstallOptions{Force: true}); err != nil {
		t.Fatalf("uninstall: %v\n%s", err, out.String())
	}
	if store.cleared != 1 {
		t.Fatalf("identity cleared %d times, want 1", store.cleared)
	}
	// Unreachable control plane: say how to finish without inventing a console verb.
	if !strings.Contains(out.String(), "DELETE /v1/hosts/host-1") {
		t.Fatalf("output does not name the way to unpair:\n%s", out.String())
	}
}

func TestMovingWorkspacesAsksTheDiskWhetherACheckoutRemains(t *testing.T) {
	ctx := context.Background()
	elsewhere := filepath.Join(t.TempDir(), "code")

	t.Run("a closed session whose worktree is still on disk holds the old directory", func(t *testing.T) {
		app, _ := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
		session := openSession(t, app)
		if err := os.MkdirAll(session.Worktree, 0o700); err != nil {
			t.Fatal(err)
		}
		// The fake removes the worktree from its own books, not from disk: a
		// close that left the directory behind.
		if _, err := app.Sessions.Close(ctx, session.ID, sessionsapp.CloseInput{Force: true}); err != nil {
			t.Fatal(err)
		}

		err := app.Workspaces(ctx, &bytes.Buffer{}, elsewhere)
		if err == nil || !strings.Contains(err.Error(), session.ID) {
			t.Fatalf("err = %v, want a refusal naming %s", err, session.ID)
		}
	})

	t.Run("a session whose worktree is gone does not", func(t *testing.T) {
		app, _ := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
		openSession(t, app) // open, but nothing on disk

		if err := app.Workspaces(ctx, &bytes.Buffer{}, elsewhere); err != nil {
			t.Fatalf("move refused with no checkout on disk: %v", err)
		}
	})
}

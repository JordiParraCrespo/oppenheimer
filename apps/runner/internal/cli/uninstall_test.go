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
	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/memory"
	pairapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	svcapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	svcdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
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
		Store: &sessionStore{}, Places: fake.NewPlaces(), Layout: sessionsdomain.Layout{Root: workspaces},
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

// signer signs anything, so the control plane is asked.
type signer struct{}

func (signer) Sign(ed25519.PrivateKey, pairdomain.BootClaims) (string, error) {
	return "the.boot.jwt", nil
}

// reachable gives the app a control plane that answers what cp is set to.
func reachable(app *cli.App, store *identityStore) *memory.ControlPlane {
	cp := memory.New()
	app.Pairing = pairapp.New(pairapp.Options{Store: store, ControlPlane: cp, Signer: signer{}})
	return cp
}

func TestUninstallEndsSessionsThenErasesTheIdentity(t *testing.T) {
	app, store := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
	reachable(app, store)
	openSession(t, app)

	var out bytes.Buffer
	if err := app.Uninstall(context.Background(), &out, cli.UninstallOptions{Force: true}); err != nil {
		t.Fatalf("uninstall: %v\n%s", err, out.String())
	}
	if store.cleared != 1 {
		t.Fatalf("identity cleared %d times, want 1", store.cleared)
	}
	if !strings.Contains(out.String(), "host revoked at the control plane") {
		t.Fatalf("output does not say the host was revoked:\n%s", out.String())
	}
}

func TestUninstallThatCouldNotUnpairTheHostDoesNotExitZero(t *testing.T) {
	cases := []struct {
		name   string
		cause  error
		reason string
	}{
		{"timeout", pairdomain.ErrUnreachable.WithDetail(
			"DELETE https://cp.example.test/api/v1/hosts/self: context deadline exceeded"), "context deadline exceeded"},
		{"refused key", pairdomain.ErrRevokeRefused.WithDetail(
			"DELETE https://cp.example.test/api/v1/hosts/self answered 401: no longer accepted"), "answered 401"},
		{"server failure", pairdomain.ErrUnreachable.WithDetail(
			"DELETE https://cp.example.test/api/v1/hosts/self answered 500: no detail"), "answered 500"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app, store := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
			reachable(app, store).RevokeErr = tc.cause
			if err := os.MkdirAll(app.Paths.Workspaces, 0o700); err != nil {
				t.Fatal(err)
			}

			var out bytes.Buffer
			err := app.Uninstall(context.Background(), &out, cli.UninstallOptions{})

			// Done here, not there: a script must not read this as a clean uninstall.
			if code := cli.ExitCode(err); code != cli.ExitIncomplete {
				t.Fatalf("exit code = %d (err %v), want %d", code, err, cli.ExitIncomplete)
			}
			if !strings.Contains(err.Error(), tc.reason) || !strings.Contains(out.String(), tc.reason) {
				t.Fatalf("the underlying failure %q is not reported:\nerr: %v\n%s", tc.reason, err, out.String())
			}
			if store.cleared != 1 {
				t.Fatalf("identity cleared %d times, want 1", store.cleared)
			}
			// The key is gone, so a signed-in person finishes it: the console's
			// Remove, or the user-authenticated route — not the host's own /self.
			for _, want := range []string{
				"https://cp.example.test/settings/hosts",
				"DELETE -H \"Authorization: Bearer $TOKEN\" https://cp.example.test/api/v1/hosts/host-1",
			} {
				if !strings.Contains(out.String(), want) {
					t.Fatalf("output does not name %q:\n%s", want, out.String())
				}
			}
			if _, err := os.Stat(app.Paths.Workspaces); err != nil {
				t.Fatalf("the workspaces directory must survive an uninstall: %v", err)
			}
		})
	}
}

func TestRegisterOnAPairedHostNamesBothOriginsAndCommandsThatExist(t *testing.T) {
	app, _ := hostApp(t, fake.NewTerminals(), fake.NewWorktrees())
	app.Host = hostapp.New(hostapp.Options{Prober: hostfake.New(), WorkspaceRoot: app.Paths.Workspaces})

	err := app.Register(context.Background(), &bytes.Buffer{}, cli.RegisterOptions{
		Token: "opr_reg_0123456789abcdef0123", URL: "https://dev.example.test", AllowContainer: true,
	})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_002" {
		t.Fatalf("err = %v, want PAIR_002", err)
	}
	for _, want := range []string{"https://cp.example.test", "https://dev.example.test", " uninstall`", "register --url https://dev.example.test --force"} {
		if !strings.Contains(prob.Detail, want) {
			t.Fatalf("detail does not name %q: %s", want, prob.Detail)
		}
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

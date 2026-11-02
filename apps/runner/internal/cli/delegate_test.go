package cli

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The commands an agent types in its session (`runner sessions run|send|
// children`) reach the running daemon over its local socket, and what the
// daemon refuses comes back as the same problem, so the command's exit code
// is the daemon's decision.
func TestDelegationCommandsReachTheDaemon(t *testing.T) {
	ctx := context.Background()
	places := fake.NewPlaces()
	terminals := fake.NewTerminals()
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	parent, err := svc.Create(ctx, sessionsapp.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: sessionsdomain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	places.Folders[parent.Cwd()] = true
	// A screen the classifier reads as up, so a message can go in.
	_ = terminals.SendKeys(ctx, parent.Target(0), "❯ \n")

	socket := filepath.Join(t.TempDir(), "runner.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	app := &App{Sessions: svc, Version: "test"}
	server := &http.Server{Handler: app.localRouter("", slog.New(slog.NewTextHandler(io.Discard, nil)))} //nolint:gosec // a test server on a private socket
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	var out bytes.Buffer
	d := Delegation{Socket: socket, Self: parent.ID, Out: &out}
	if err := d.Run(ctx, ChildOptions{Agent: "codex"}, "review src/x.go"); err != nil {
		t.Fatal(err)
	}
	childID := strings.TrimSpace(out.String())
	child, err := svc.Get(childID)
	if err != nil || child.Parent != parent.ID {
		t.Fatalf("child %q: %+v, %v", childID, child, err)
	}

	out.Reset()
	if err := d.Children(ctx, ""); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), childID) {
		t.Fatalf("children listed %q", out.String())
	}

	err = d.Send(ctx, "nosuchsession", "hello")
	if err == nil || ExitCode(err) != ExitNotFound {
		t.Fatalf("sending to no session: %v (exit %d)", err, ExitCode(err))
	}

	if err := (Delegation{Socket: filepath.Join(t.TempDir(), "none.sock"), Self: parent.ID, Out: &out}).Children(ctx, ""); err == nil {
		t.Fatal("a command with no daemon to ask succeeded")
	}
}

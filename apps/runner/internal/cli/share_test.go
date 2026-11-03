package cli

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// `runner sessions send-file` from inside a session keeps the file's entry
// where that session's chat follower reads it, resolving a relative path
// against the agent's own folder; a path that is no file is refused with the
// daemon's problem, so the agent reads why.
func TestSendFileKeepsTheFileForTheSessionsChat(t *testing.T) {
	ctx := context.Background()
	places := fake.NewPlaces()
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(ctx, sessionsapp.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: sessionsdomain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}

	socket := filepath.Join(t.TempDir(), "runner.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	app := &App{Sessions: svc, Paths: Paths{Home: t.TempDir()}, Version: "test"}
	server := &http.Server{Handler: app.localRouter("", slog.New(slog.NewTextHandler(io.Discard, nil)))} //nolint:gosec // a test server on a private socket
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	work := t.TempDir()
	if err := os.WriteFile(filepath.Join(work, "notes.md"), []byte("# Two bugs\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Chdir(work)

	var out bytes.Buffer
	d := Delegation{Socket: socket, Self: session.ID, Out: &out}
	if err := d.SendFile(ctx, "notes.md", "What I found"); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "shared notes.md (text/markdown") {
		t.Fatalf("printed %q", out.String())
	}
	entries, err := os.ReadDir(transcript.SharedDir(app.Paths.Files(), session.ID))
	if err != nil || len(entries) != 1 {
		t.Fatalf("kept %v, %v", entries, err)
	}

	err = d.SendFile(ctx, work, "")
	if err == nil || !strings.Contains(err.Error(), "not a regular file") {
		t.Fatalf("sharing a directory: %v", err)
	}
}

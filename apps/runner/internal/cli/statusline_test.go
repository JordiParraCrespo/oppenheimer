package cli_test

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/cli"
)

const statusConversation = "3f1c2b8e-4a5d-4c6e-9f70-1a2b3c4d5e6f"

// statusPayload is what Claude Code hands its status line, abridged, for a
// session working in project.
func statusPayload(project string) string {
	return `{"session_id":"` + statusConversation + `","cwd":"` + project + `",` +
		`"workspace":{"current_dir":"` + project + `","project_dir":"` + project + `"},` +
		`"context_window":{"context_window_size":200000,"used_percentage":32},` +
		`"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":1793040000}}}`
}

// statusHome is a fresh account home and runner home for one test.
func statusHome(t *testing.T) (home, project string) {
	t.Helper()
	home = t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv(cli.EnvHome, filepath.Join(home, ".oppenheimer"))
	t.Setenv("CLAUDE_CONFIG_DIR", "")
	project = filepath.Join(home, "w", "sessions", "bold-otter")
	if err := os.MkdirAll(filepath.Join(project, ".claude"), 0o700); err != nil {
		t.Fatal(err)
	}
	return home, project
}

func runStatusLine(t *testing.T, payload string) string {
	t.Helper()
	var out bytes.Buffer
	if err := cli.StatusLine(context.Background(), strings.NewReader(payload), &out); err != nil {
		t.Fatal(err)
	}
	return out.String()
}

func TestTheStatusLineKeepsTheFiguresAndShowsThemWhenThePersonHasNone(t *testing.T) {
	home, project := statusHome(t)
	if got := runStatusLine(t, statusPayload(project)); got != "ctx 32% · 5h 23%\n" {
		t.Fatalf("line = %q", got)
	}
	paths, err := cli.ResolvePaths()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(cli.StatusDir(paths), statusConversation+".json")); err != nil {
		t.Fatalf("status not kept under %s: %v", home, err)
	}
}

func TestThePersonsOwnStatusLineStillDrawsTheLine(t *testing.T) {
	home, project := statusHome(t)
	writeSettings := func(path, command string) {
		t.Helper()
		body := `{"statusLine":{"type":"command","command":` + quoteJSON(command) + `}}`
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	// Their own, read on the same payload, in the session's folder.
	writeSettings(filepath.Join(home, ".claude", "settings.json"), `printf 'mine %s' "$(basename "$PWD")"; grep -q rate_limits && echo ' sees the payload'`)
	if got := runStatusLine(t, statusPayload(project)); got != "mine bold-otter sees the payload\n" {
		t.Fatalf("line = %q", got)
	}
	// The project's local settings come first, as Claude Code reads them.
	writeSettings(filepath.Join(project, ".claude", "settings.local.json"), `cat >/dev/null; echo local`)
	if got := runStatusLine(t, statusPayload(project)); got != "local\n" {
		t.Fatalf("line = %q", got)
	}
}

func TestAStatusLineRunByTheRunnersOwnIsNeverRunAgain(t *testing.T) {
	home, project := statusHome(t)
	body := `{"statusLine":{"type":"command","command":` + quoteJSON(`cat >/dev/null; echo "nested=$OPPENHEIMER_STATUSLINE"`) + `}}`
	if err := os.MkdirAll(filepath.Join(home, ".claude"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".claude", "settings.json"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	// Their status line knows it is run by the runner's...
	if got := runStatusLine(t, statusPayload(project)); got != "nested=1\n" {
		t.Fatalf("line = %q", got)
	}
	// ...so a `runner statusline` it runs draws the figures instead of
	// running theirs again, however their settings name the runner.
	t.Setenv("OPPENHEIMER_STATUSLINE", "1")
	if got := runStatusLine(t, statusPayload(project)); got != "ctx 32% · 5h 23%\n" {
		t.Fatalf("line = %q", got)
	}
}

func quoteJSON(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"', '\\':
			b.WriteByte('\\')
		}
		b.WriteRune(r)
	}
	b.WriteByte('"')
	return b.String()
}

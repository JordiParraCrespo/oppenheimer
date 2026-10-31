package cloud

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// fakeCodex writes a stand-in for the CLI that runs script with the CLI's
// arguments, and records them, one per line, in the returned file.
func fakeCodex(t *testing.T, script string) (bin, args string) {
	t.Helper()
	dir := t.TempDir()
	bin, args = filepath.Join(dir, "codex"), filepath.Join(dir, "args")
	body := "#!/bin/sh\n" +
		"for a in \"$@\"; do printf '%s\\n' \"$a\" >> '" + args + "'; done\n" +
		"[ \"$1\" = cloud ] || { echo \"unexpected args: $*\" >&2; exit 2; }\n" +
		script
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	return bin, args
}

func readArgs(t *testing.T, path string) []string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return strings.Split(strings.TrimSpace(string(raw)), "\n")
}

func TestCodexStartReadsTheTaskTheCLINamed(t *testing.T) {
	bin, args := fakeCodex(t, `echo 'https://chatgpt.com/codex/tasks/task_e_68a1b2c3d4'`)
	started, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/xrp-mobile", "develop", "Fix the wallet list")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	want := Started{ID: "task_e_68a1b2c3d4", URL: "https://chatgpt.com/codex/tasks/task_e_68a1b2c3d4"}
	if started != want {
		t.Fatalf("started = %+v, want %+v", started, want)
	}
	got := strings.Join(readArgs(t, args), " ")
	if got != "cloud exec --env acme-labs/xrp-mobile --branch develop Fix the wallet list" {
		t.Fatalf("args = %q", got)
	}
}

// People name a Codex environment after the repository either way; the CLI
// says which label it has not got, and the bare name is tried next.
func TestCodexStartTriesTheRepositorysBareNameNext(t *testing.T) {
	bin, args := fakeCodex(t, `[ "$4" = xrp-mobile ] || { echo "Error: environment '$4' not found; run codex cloud to list available environments" >&2; exit 1; }
echo 'https://chatgpt.com/codex/tasks/task_e_1'`)
	started, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if started.ID != "task_e_1" {
		t.Fatalf("started = %+v", started)
	}
	if got := readArgs(t, args); len(got) != 14 || got[3] != "acme-labs/xrp-mobile" || got[10] != "xrp-mobile" {
		t.Fatalf("args = %q, want the full name tried before the bare name", got)
	}
}

// An environment made in ChatGPT's Settings → Codex Cloud is invisible to
// `codex cloud exec`, so a repository whose only environment is there fails
// under every label. That is its own code, naming the labels tried, the ones
// the CLI shows in recent tasks and where the newer environments live.
func TestCodexStartSaysWhichEnvironmentsTheCLICanSee(t *testing.T) {
	bin, args := fakeCodex(t, `if [ "$2" = list ]; then cat <<'JSON'
{"tasks": [
  {"id": "task_e_3", "url": "u", "title": "a", "status": "ready", "environment_label": "kallista"},
  {"id": "task_e_2", "url": "u", "title": "b", "status": "ready", "environment_label": "woocommerce-elementor-ai-template"},
  {"id": "task_e_1", "url": "u", "title": "c", "status": "ready", "environment_label": "Kallista"},
  {"id": "task_e_0", "url": "u", "title": "d", "status": "error", "environment_label": "Oppenheimer"}
], "cursor": ""}
JSON
exit 0; fi
echo "Error: environment '$4' not found; run `+"`codex cloud`"+` to list available environments" >&2; exit 1`)
	_, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/oppenheimer", "main", "task")
	pe := problem.From(err)
	if pe == nil || pe.Code != domain.ErrCodexCloudEnvironment.Code {
		t.Fatalf("err = %v, want ErrCodexCloudEnvironment", err)
	}
	for _, want := range []string{
		"acme-labs/oppenheimer or oppenheimer",
		"recent tasks: kallista, woocommerce-elementor-ai-template (",
		"Settings → Codex Cloud are not reachable by the CLI",
	} {
		if !strings.Contains(pe.Detail, want) {
			t.Errorf("detail = %q, want it to say %q", pe.Detail, want)
		}
	}
	if got := strings.Join(readArgs(t, args)[14:], " "); got != "cloud list --json --limit 20" {
		t.Fatalf("args after the two tries = %q, want one page of tasks read", got)
	}
}

// The labels are a courtesy: a list the CLI cannot answer still ends in the
// same code, saying it could not read them.
func TestCodexStartNamesNoEnvironmentsWhenTheyCannotBeRead(t *testing.T) {
	bin, _ := fakeCodex(t, `[ "$2" = list ] && { echo "Not signed in." >&2; exit 1; }
echo "Error: environment '$4' not found" >&2; exit 1`)
	_, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/oppenheimer", "main", "task")
	pe := problem.From(err)
	if pe == nil || pe.Code != domain.ErrCodexCloudEnvironment.Code {
		t.Fatalf("err = %v, want ErrCodexCloudEnvironment", err)
	}
	if !strings.Contains(pe.Detail, "recent tasks: could not be read") {
		t.Fatalf("detail = %q", pe.Detail)
	}
}

// Only the CLI's own "environment '<label>' not found" for the label just
// tried is a missing environment. Another refusal that also says "not found"
// is the CLI's answer, in its words, and no other label is tried.
func TestCodexStartReadsOnlyTheMissingEnvironmentRefusalAsOne(t *testing.T) {
	bin, args := fakeCodex(t, `echo "Error: branch 'main' not found on the remote" >&2; exit 1`)
	_, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task")
	pe := problem.From(err)
	if pe == nil || pe.Code != domain.ErrCodexCloudStart.Code {
		t.Fatalf("err = %v, want ErrCodexCloudStart", err)
	}
	if got := readArgs(t, args); len(got) != 7 {
		t.Fatalf("args = %q, want one try", got)
	}
}

// A refusal other than a missing environment is not tried again under
// another label: it is the CLI's answer, in its own words.
func TestCodexStartSaysWhyTheCLIRefused(t *testing.T) {
	bin, args := fakeCodex(t, `echo "Not signed in. Please run 'codex login' to sign in with ChatGPT, then re-run 'codex cloud'." >&2
exit 1`)
	_, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task")
	pe := problem.From(err)
	if pe == nil || pe.Code != domain.ErrCodexCloudStart.Code {
		t.Fatalf("err = %v, want ErrCodexCloudStart", err)
	}
	if !strings.Contains(pe.Detail, "codex login") {
		t.Fatalf("detail = %v, want the CLI's words", err)
	}
	if got := readArgs(t, args); len(got) != 7 {
		t.Fatalf("args = %q, want one try", got)
	}
}

func TestCodexStartRefusesAnAnswerWithNoTask(t *testing.T) {
	bin, _ := fakeCodex(t, `echo 'Submitted.'`)
	_, err := Codex{Command: bin}.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task")
	if pe := problem.From(err); pe == nil || pe.Code != domain.ErrCodexCloudStart.Code {
		t.Fatalf("err = %v, want ErrCodexCloudStart", err)
	}
}

func TestCodexListReadsTheTasksAndTheNextCursor(t *testing.T) {
	bin, args := fakeCodex(t, `cat <<'JSON'
{
  "tasks": [
    {"id": "task_e_2", "url": "https://chatgpt.com/codex/tasks/task_e_2", "title": "Fix the wallet list",
     "status": "ready", "updated_at": "2026-10-29T10:00:00Z", "environment_id": "env_1",
     "summary": {"files_changed": 2, "lines_added": 10, "lines_removed": 3}, "is_review": false, "attempt_total": 1},
    {"id": "task_e_1", "url": "https://chatgpt.com/codex/tasks/task_e_1", "title": "Bump deps", "status": "pending"}
  ],
  "cursor": "c2"
}
JSON`)
	page, err := Codex{Command: bin}.List(context.Background(), "c1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(page.Tasks) != 2 || page.Tasks[0].Status != CodexReady || page.Tasks[1].ID != "task_e_1" || page.Cursor != "c2" {
		t.Fatalf("page = %+v", page)
	}
	if got := strings.Join(readArgs(t, args), " "); got != "cloud list --json --limit 20 --cursor c1" {
		t.Fatalf("args = %q", got)
	}
}

func TestCodexSettledIsFinishedOrFailed(t *testing.T) {
	for status, want := range map[string]bool{
		CodexPending: false, CodexReady: true, CodexApplied: true, CodexError: true, "": false, "queued": false,
	} {
		if got := CodexSettled(status); got != want {
			t.Errorf("CodexSettled(%q) = %v, want %v", status, got, want)
		}
	}
}

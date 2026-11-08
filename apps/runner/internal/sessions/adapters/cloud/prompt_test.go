package cloud

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// fakePromptCLI writes a stand-in for `claude -p <text> --cloud <id>
// --output-format json` that checks its arguments, then runs script.
func fakePromptCLI(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "claude")
	body := "#!/bin/sh\n" +
		"[ \"$1 $2 $3 $4 $5 $6\" = \"-p --cloud session_014a8EH8DJs95X1iK8ZH9Y82 --output-format json --\" ] || { echo \"unexpected args: $*\" >&2; exit 2; }\n" +
		"[ \"$7\" = '- Yes; and $(rm -rf /)' ] || { echo \"unexpected text: $7\" >&2; exit 2; }\n" +
		script
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// The text starts with "-", as a list does: it must still be the message.
const promptID, promptText = "session_014a8EH8DJs95X1iK8ZH9Y82", "- Yes; and $(rm -rf /)"

func codeOf(err error) string {
	if pe := problem.From(err); pe != nil {
		return pe.Code
	}
	return ""
}

// The regression this guards: a reply that reaches the CLI as anything but
// one argument after `--` (one starting with "-" read as an option), a queued message reported as a failure (or a refusal as
// queued, so the console thinks the session woke), and a CLI that is not
// signed in reported as anything but the code the person fixes on the host.
func TestPromptQueuesTheMessageOrSaysWhyNot(t *testing.T) {
	ok := fakePromptCLI(t, `echo '{"ok":true,"session_id":"session_014a8EH8DJs95X1iK8ZH9Y82","url":"https://claude.ai/code/session_014a8EH8DJs95X1iK8ZH9Y82"}'`)
	if err := (Prompter{Command: ok}).Prompt(context.Background(), promptID, promptText); err != nil {
		t.Fatalf("queued: %v", err)
	}

	notOK := fakePromptCLI(t, `echo '{"ok":false,"error":"Session not found"}'`)
	err := Prompter{Command: notOK}.Prompt(context.Background(), promptID, promptText)
	if codeOf(err) != domain.ErrCloudPrompt.Code {
		t.Fatalf("ok false: %v", err)
	}

	exits := fakePromptCLI(t, `echo 'Error: unknown session' >&2; exit 1`)
	err = Prompter{Command: exits}.Prompt(context.Background(), promptID, promptText)
	if codeOf(err) != domain.ErrCloudPrompt.Code {
		t.Fatalf("exit 1: %v", err)
	}

	signedOutCLI := fakePromptCLI(t, "echo 'Cloud sessions need a claude.ai sign-in. Run `claude auth login`, then try again.' >&2; exit 1")
	err = Prompter{Command: signedOutCLI}.Prompt(context.Background(), promptID, promptText)
	if codeOf(err) != domain.ErrCloudSignIn.Code {
		t.Fatalf("signed out: %v", err)
	}
}

// The regression this guards: a CLI that never returns holding the
// session's prompt lane for good, and a CLI stopped before it answered
// reported as a refusal, so the control plane hands the reply to the next
// Stop hook while the session may already have it.
func TestPromptGivesUpOnACLIThatHangs(t *testing.T) {
	hangs := fakePromptCLI(t, "exec sleep 30")
	start := time.Now()
	err := Prompter{Command: hangs, Timeout: 300 * time.Millisecond}.Prompt(context.Background(), promptID, promptText)
	if codeOf(err) != domain.ErrCloudPromptUnanswered.Code || !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("hung: %v", err)
	}
	if time.Since(start) > 5*time.Second {
		t.Fatalf("took %s", time.Since(start))
	}
}

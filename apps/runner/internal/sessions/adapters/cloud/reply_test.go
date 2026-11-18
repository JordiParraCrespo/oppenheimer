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

// fakeReplyClaude writes a stand-in for `claude -p … --cloud <id>` that
// checks it was given the message as one argument after `--`, then runs script.
func fakeReplyClaude(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "claude")
	body := "#!/bin/sh\n" +
		"[ \"$1 $2 $3 $4 $5 $6\" = '-p --cloud session_01KpKLr6MbnpttWW --output-format json --' ] || { echo \"unexpected args: $*\" >&2; exit 2; }\n" +
		"[ \"$7\" = '-n now tag it' ] || { echo \"message: $7\" >&2; exit 2; }\n" +
		script
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func send(t *testing.T, claude string) error {
	t.Helper()
	return Replier{Command: claude, Timeout: 5 * time.Second}.Send(context.Background(), "session_01KpKLr6MbnpttWW", "-n now tag it")
}

func TestReplySentWhenTheCLIAnswersOk(t *testing.T) {
	claude := fakeReplyClaude(t, `echo 'Sending to cloud session…' >&2
echo '{"ok":true,"session_id":"session_01KpKLr6MbnpttWW"}'
`)
	if err := send(t, claude); err != nil {
		t.Fatalf("Send: %v", err)
	}
}

// A refusal is the CLI's own words under SESS_020, never a silent success:
// the control plane hands the reply back to the Stop hook on it.
func TestReplyRefusedIsTheCLIsReason(t *testing.T) {
	claude := fakeReplyClaude(t, `echo '{"ok":false,"error":"Session not found"}'
exit 1
`)
	err := send(t, claude)
	if pe := problem.From(err); pe == nil || pe.Code != domain.ErrCloudReply.Code || pe.Detail != "Session not found" {
		t.Fatalf("err = %v, want SESS_020 with the CLI's reason", err)
	}
}

func TestReplyWithoutOkIsRefused(t *testing.T) {
	claude := fakeReplyClaude(t, `echo 'something else'
`)
	if pe := problem.From(send(t, claude)); pe == nil || pe.Code != domain.ErrCloudReply.Code {
		t.Fatalf("an answer without ok must not read as sent")
	}
}

func TestReplyOnASignedOutHostIsSignIn(t *testing.T) {
	claude := fakeReplyClaude(t, `echo 'Cloud sessions need a claude.ai sign-in. Run claude auth login, then try again.' >&2
exit 1
`)
	if pe := problem.From(send(t, claude)); pe == nil || pe.Code != domain.ErrCloudSignIn.Code {
		t.Fatalf("a signed-out host must be SESS_019")
	}
}

func TestReplyPastItsTimeIsRefused(t *testing.T) {
	claude := fakeReplyClaude(t, "sleep 5\n")
	err := Replier{Command: claude, Timeout: 200 * time.Millisecond}.Send(context.Background(), "session_01KpKLr6MbnpttWW", "-n now tag it")
	// Unconfirmed, not refused: the message may have reached the session.
	if pe := problem.From(err); pe == nil || pe.Code != domain.ErrCloudReplyUnconfirmed.Code || !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, want SESS_021", err)
	}
}

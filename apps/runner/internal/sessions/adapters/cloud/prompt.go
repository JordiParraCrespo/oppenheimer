package cloud

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Prompter sends a message to a cloud session that already exists with
// `claude -p <text> --cloud <id> --output-format json`, which queues it in the
// session, waking it when it is idle, and exits (product/research/cloud-agents.md,
// "CLI"). Unlike a start it needs no terminal and no checkout: print mode asks
// no question. The zero value runs `claude` from PATH with a one-minute limit.
type Prompter struct {
	// Command is the CLI to run; empty is "claude".
	Command string
	// Timeout bounds the call; zero is one minute.
	Timeout time.Duration
}

// promptAnswer is what `--output-format json` prints for a queued message:
// `{"ok": true, "session_id": "session_…", "url": "…"}`. A refusal may say
// `ok: false` with its reason.
type promptAnswer struct {
	OK      *bool  `json:"ok"`
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Prompt queues text in the cloud session id (`session_…`). A CLI that is
// not signed in to claude.ai is ErrCloudSignIn; any other refusal, or a CLI
// that ran past its limit, is ErrCloudPrompt with the CLI's last words.
func (p Prompter) Prompt(ctx context.Context, id, text string) error {
	ctx, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()

	cmd := exec.CommandContext(ctx, p.command(), //nolint:gosec // the CLI by name, each value one argument: no shell reads them
		"-p", text, "--cloud", id, "--output-format", "json")
	cmd.Env = os.Environ()
	// The home directory, not the runner's: the session lives at claude.ai,
	// and nothing here reads the folder it runs in.
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	runErr := cmd.Run()

	said := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
	if ctx.Err() != nil {
		return domain.ErrCloudPrompt.WithDetail(
			"claude -p --cloud did not finish within %s: %s", p.timeout(), lastWords(said)).WithCause(ctx.Err())
	}
	var answer promptAnswer
	parsed := json.Unmarshal(bytes.TrimSpace(stdout.Bytes()), &answer) == nil
	refused := runErr != nil || (parsed && answer.OK != nil && !*answer.OK)
	if !refused {
		return nil
	}
	detail := lastWords(said)
	if parsed && answer.Error+answer.Message != "" {
		detail = strings.TrimSpace(answer.Error + " " + answer.Message)
	}
	if detail == "" && runErr != nil {
		detail = runErr.Error()
	}
	if signedOut.MatchString(said) {
		return domain.ErrCloudSignIn.WithDetail("%s", detail)
	}
	err := domain.ErrCloudPrompt.WithDetail("%s", detail)
	var exit *exec.ExitError
	if runErr != nil && !errors.As(runErr, &exit) {
		return err.WithCause(runErr)
	}
	return err
}

func (p Prompter) command() string {
	if p.Command == "" {
		return "claude"
	}
	return p.Command
}

func (p Prompter) timeout() time.Duration {
	if p.Timeout <= 0 {
		return time.Minute
	}
	return p.Timeout
}

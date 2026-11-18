package cloud

// Replying to a cloud session (`cloud.reply`): the person's message, sent with
// `claude -p <text> --cloud <id> --output-format json`, which hands it to the
// session as its next message and wakes it when it is idle. It needs no
// terminal and no checkout, only the claude.ai account the session runs on,
// and answers one JSON object: `{"ok":true,…}` once the session has it.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Replier runs `claude -p … --cloud <id>`. The zero value runs `claude` from
// PATH with a 45-second limit.
type Replier struct {
	// Command is the CLI to run; empty is "claude".
	Command string
	// Timeout bounds the send; zero is 45 seconds.
	Timeout time.Duration
}

// replyAnswer is what `--output-format json` prints for a cloud send: `ok`,
// and on a refusal the CLI's reason under one of these names.
type replyAnswer struct {
	OK      *bool  `json:"ok"`
	Error   string `json:"error"`
	Message string `json:"message"`
	Result  string `json:"result"`
}

// Send gives text to the cloud session id. A nil error means Claude Code took
// it; ErrCloudSignIn is a host with no claude.ai account,
// ErrCloudReplyUnconfirmed no answer in time, and ErrCloudReply every other
// refusal, in the CLI's own words. The text is one argument after
// `--`, so a message that starts with a dash is never read as a flag.
func (r Replier) Send(ctx context.Context, id, text string) error {
	ctx, cancel := context.WithTimeout(ctx, r.timeout())
	defer cancel()

	cmd := exec.CommandContext(ctx, r.command(), "-p", "--cloud", id, "--output-format", "json", "--", text) //nolint:gosec // the CLI by name, every value one argument: no shell reads them
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}
	cmd.Env = os.Environ()
	// Its own process group, all of it stopped past the time limit: a helper
	// it started would otherwise hold the pipes, and the send, open.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process != nil {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		return nil
	}
	cmd.WaitDelay = time.Second
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	runErr := cmd.Run()
	if ctx.Err() != nil {
		return domain.ErrCloudReplyUnconfirmed.WithDetail("claude --cloud did not answer within %s", r.timeout()).WithCause(ctx.Err())
	}
	return replied(stdout.String(), stderr.String(), runErr)
}

// replied reads the CLI's answer: ok only when it printed `"ok": true` and
// exited cleanly.
func replied(stdout, stderr string, runErr error) error {
	var answer replyAnswer
	parsed := json.Unmarshal([]byte(lastJSONLine(stdout)), &answer) == nil
	if parsed && answer.OK != nil && *answer.OK && runErr == nil {
		return nil
	}
	detail := firstNonEmpty(answer.Error, answer.Message, answer.Result, lastWords(stderr), lastWords(stdout))
	if detail == "" && runErr != nil {
		detail = runErr.Error()
	}
	if detail == "" {
		detail = "claude --cloud answered without ok"
	}
	if signedOut.MatchString(stdout + "\n" + stderr) {
		return domain.ErrCloudSignIn.WithDetail("%s", detail)
	}
	err := domain.ErrCloudReply.WithDetail("%s", detail)
	var exit *exec.ExitError
	if runErr != nil && !errors.As(runErr, &exit) {
		return err.WithCause(runErr)
	}
	return err
}

// lastJSONLine is the last line of out that looks like a JSON object: the
// answer, past anything the CLI printed before it.
func lastJSONLine(out string) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if line := strings.TrimSpace(lines[i]); strings.HasPrefix(line, "{") {
			return line
		}
	}
	return strings.TrimSpace(out)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}

func (r Replier) command() string {
	if r.Command == "" {
		return "claude"
	}
	return r.Command
}

func (r Replier) timeout() time.Duration {
	if r.Timeout <= 0 {
		return 45 * time.Second
	}
	return r.Timeout
}

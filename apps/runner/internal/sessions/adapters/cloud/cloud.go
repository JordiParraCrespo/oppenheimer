// Package cloud starts a task in Claude Code's cloud with the person's own
// `claude` CLI, the only legitimate driver of their claude.ai account
// (product/research/cloud-agents.md §2, §5B).
//
// `claude --cloud <task>` creates a cloud session from the current
// directory's GitHub repository and prints where it went:
//
//	Created cloud session: <title>
//	View: https://claude.ai/code/session_…?from=cli&m=0
//	Resume with: claude --teleport session_…
//
// It refuses to run without a terminal ("--cloud requires an interactive
// terminal"), so it is given one: a pseudo-terminal whose input is closed at
// once, which makes it create the session and exit rather than attach.
package cloud

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Started is the cloud session `claude --cloud` made.
type Started struct {
	// ID is the cloud session's id, `session_…`.
	ID string
	// URL is its page on claude.ai/code.
	URL string
	// Title is the name Claude Code gave it, when it printed one.
	Title string
}

// Starter runs `claude --cloud`. The zero value runs `claude` from PATH with
// a two-minute limit.
type Starter struct {
	// Command is the CLI to run; empty is "claude".
	Command string
	// Timeout bounds the whole start; zero is two minutes.
	Timeout time.Duration
	// Trust answers Claude Code's "do you trust this folder?" for dir before
	// the CLI runs: each start is in a scratch checkout it has never seen,
	// and the question would hold it until the timeout, so a folder it cannot
	// mark fails the start at once. Nil asks nothing.
	Trust func(dir string) error
	// Prepare answers Claude Code's questions about the machine, not the
	// folder, before the CLI runs: today "use this machine's settings in cloud
	// sessions?". An answer it cannot record fails the start at once. Nil
	// asks nothing.
	Prepare func() error
	// Forget undoes what Trust recorded for dir, once the CLI is gone: the
	// checkout is removed after every start, and an answer kept for it would
	// only pile up in Claude Code's state. Nil forgets nothing.
	Forget func(dir string)
}

var (
	ansi    = regexp.MustCompile(`\x1b\[[0-9;?<>=]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-_]`)
	viewURL = regexp.MustCompile(`https://claude\.ai/code/(session_[A-Za-z0-9]+)`)
	created = regexp.MustCompile(`Created cloud session: ([^\r\n]+)`)
)

// blockingPrompt is a question Claude Code asks before it creates the
// session, which nobody can answer with input closed. Seen names the CLI's
// own wording, so a release that rewords one only loses the early failure:
// the start still ends at the timeout.
type blockingPrompt struct {
	seen string
	// detail is the failure, given dir.
	detail func(dir string) string
}

var blockingPrompts = []blockingPrompt{
	// "Do you trust this folder?" (2.1.x), which Trust answers ahead.
	{seen: "Yes, I trust this folder", detail: func(dir string) string {
		return "claude --cloud asks whether to trust " + dir + ", and nobody is there to answer"
	}},
	// "Use this machine's settings in cloud sessions?" (2.1.31x), asked once
	// per machine, which Prepare answers ahead.
	{seen: "Yes, send my settings", detail: func(string) string {
		return "claude --cloud asks whether to use this machine's settings in cloud sessions, and nobody is there to answer: " +
			"run `claude --cloud` once on this host and answer it, or set it with /config"
	}},
}

// blockedOn is the question the CLI is waiting on, if it is one it cannot be
// answered on.
func blockedOn(raw string) (blockingPrompt, bool) {
	text := clean(raw)
	for _, prompt := range blockingPrompts {
		if strings.Contains(text, prompt.seen) {
			return prompt, true
		}
	}
	return blockingPrompt{}, false
}

// Start creates the cloud session for prompt from the repository checked out
// in dir. It answers once the CLI has named the session, and gives the CLI a
// few seconds to exit on its own before it is stopped.
func (s Starter) Start(ctx context.Context, dir, prompt string) (Started, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout())
	defer cancel()

	if s.Trust != nil {
		if err := s.Trust(dir); err != nil {
			return Started{}, domain.ErrCloudStart.WithDetail("trust %s for claude: %v", dir, err).WithCause(err)
		}
	}
	if s.Forget != nil {
		// Deferred first, so it runs last: after the CLI and everything it
		// started are gone and can no longer write Claude Code's state.
		defer s.Forget(dir)
	}
	if s.Prepare != nil {
		if err := s.Prepare(); err != nil {
			return Started{}, domain.ErrCloudStart.WithDetail("answer claude's cloud settings question: %v", err).WithCause(err)
		}
	}

	cmd := exec.CommandContext(ctx, s.command(), "--cloud", prompt) //nolint:gosec // the CLI by name, and the task one argument: no shell reads it
	cmd.Dir = dir
	cmd.Env = os.Environ()
	// A start past its time limit stops the whole group, not only the CLI.
	cmd.Cancel = func() error { killGroup(cmd); return nil }
	term, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 50, Cols: 200})
	if err != nil {
		return Started{}, domain.ErrCloudStart.WithDetail("run %s: %v", s.command(), err).WithCause(err)
	}
	defer func() { _ = term.Close() }()

	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	// However the start ends, nothing it ran outlives it: the CLI and every
	// process it started (pty.Start made it a session leader, so they share
	// its process group) are stopped and reaped before Start returns, so no
	// claude is left running on the host and none holds the checkout open
	// while it is removed.
	gone := false
	defer func() {
		killGroup(cmd)
		if !gone {
			select {
			case <-exited:
			case <-time.After(5 * time.Second):
			}
		}
	}()

	// End of input, as `claude --cloud … </dev/null` under a terminal gets: it
	// creates the session and leaves instead of opening the conversation.
	_, _ = term.Write([]byte{4})

	out := &transcript{}
	copied := make(chan struct{})
	go func() {
		_, _ = io.Copy(out, term)
		close(copied)
	}()

	tick := time.NewTicker(100 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case exitErr := <-exited:
			gone = true
			// The terminal drains after the process: read what is left.
			select {
			case <-copied:
			case <-time.After(time.Second):
			}
			if started, ok := parse(out.String()); ok {
				return started, nil
			}
			return Started{}, failed(out.String(), exitErr)
		case <-tick.C:
			if started, ok := parse(out.String()); ok {
				// Named: let it finish printing and exit; the deferred stop
				// ends it, and anything it left behind, either way.
				select {
				case <-exited:
					gone = true
				case <-time.After(5 * time.Second):
				}
				return started, nil
			}
			if prompt, ok := blockedOn(out.String()); ok {
				return Started{}, domain.ErrCloudStart.WithDetail("%s: %s", prompt.detail(dir), lastWords(out.String()))
			}
		case <-ctx.Done():
			return Started{}, domain.ErrCloudStart.WithDetail(
				"claude --cloud named no session within %s: %s", s.timeout(), lastWords(out.String())).
				WithCause(ctx.Err())
		}
	}
}

// killGroup stops the CLI's process group: the CLI and whatever it started
// that is still there (a hook, an MCP server, a helper it spawned). A group
// already gone answers ESRCH, which is what stopping it wanted.
func killGroup(cmd *exec.Cmd) {
	if cmd.Process == nil {
		return
	}
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}

func parse(raw string) (Started, bool) {
	text := clean(raw)
	match := viewURL.FindStringSubmatch(text)
	if match == nil {
		return Started{}, false
	}
	started := Started{ID: match[1], URL: "https://claude.ai/code/" + match[1]}
	if title := created.FindStringSubmatch(text); title != nil {
		started.Title = strings.TrimSpace(title[1])
	}
	return started, true
}

func failed(raw string, waitErr error) error {
	detail := lastWords(raw)
	if detail == "" && waitErr != nil {
		detail = waitErr.Error()
	}
	err := domain.ErrCloudStart.WithDetail("%s", detail)
	if waitErr != nil {
		var exit *exec.ExitError
		if !errors.As(waitErr, &exit) {
			return err.WithCause(waitErr)
		}
	}
	return err
}

// lastWords is the CLI's last few lines, without its colours: what it said
// when it refused.
func lastWords(raw string) string {
	var lines []string
	for _, line := range strings.Split(clean(raw), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) > 3 {
		lines = lines[len(lines)-3:]
	}
	text := strings.Join(lines, " · ")
	if len(text) > 400 {
		text = text[:400] + "…"
	}
	return text
}

// clean drops the terminal's colours and its echo of the end of input.
func clean(raw string) string {
	text := strings.ReplaceAll(ansi.ReplaceAllString(raw, ""), "^D", "")
	return strings.ReplaceAll(text, "\r", "\n")
}

func (s Starter) command() string {
	if s.Command == "" {
		return "claude"
	}
	return s.Command
}

func (s Starter) timeout() time.Duration {
	if s.Timeout <= 0 {
		return 2 * time.Minute
	}
	return s.Timeout
}

// transcript is the terminal's output so far, safe to read while it grows.
type transcript struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (t *transcript) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.buf.Write(p)
}

func (t *transcript) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.buf.String()
}

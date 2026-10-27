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
}

var (
	ansi    = regexp.MustCompile(`\x1b\[[0-9;?<>=]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-_]`)
	viewURL = regexp.MustCompile(`https://claude\.ai/code/(session_[A-Za-z0-9]+)`)
	created = regexp.MustCompile(`Created cloud session: ([^\r\n]+)`)
)

// Start creates the cloud session for prompt from the repository checked out
// in dir. It answers once the CLI has named the session, and gives the CLI a
// few seconds to exit on its own before it is stopped.
func (s Starter) Start(ctx context.Context, dir, prompt string) (Started, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout())
	defer cancel()

	cmd := exec.CommandContext(ctx, s.command(), "--cloud", prompt) //nolint:gosec // the CLI by name, and the task one argument: no shell reads it
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.WaitDelay = 5 * time.Second
	term, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 50, Cols: 200})
	if err != nil {
		return Started{}, domain.ErrCloudStart.WithDetail("run %s: %v", s.command(), err).WithCause(err)
	}
	defer func() { _ = term.Close() }()
	// End of input, as `claude --cloud … </dev/null` under a terminal gets: it
	// creates the session and leaves instead of opening the conversation.
	_, _ = term.Write([]byte{4})

	out := &transcript{}
	copied := make(chan struct{})
	go func() {
		_, _ = io.Copy(out, term)
		close(copied)
	}()

	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()

	tick := time.NewTicker(100 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case waitErr := <-exited:
			// The terminal drains after the process: read what is left.
			select {
			case <-copied:
			case <-time.After(time.Second):
			}
			if started, ok := parse(out.String()); ok {
				return started, nil
			}
			return Started{}, failed(out.String(), waitErr)
		case <-tick.C:
			if started, ok := parse(out.String()); ok {
				// Named: let it finish printing and exit, or stop it.
				select {
				case <-exited:
				case <-time.After(5 * time.Second):
					_ = cmd.Process.Kill()
				}
				return started, nil
			}
		case <-ctx.Done():
			_ = cmd.Process.Kill()
			return Started{}, domain.ErrCloudStart.WithDetail(
				"claude --cloud named no session within %s: %s", s.timeout(), lastWords(out.String())).
				WithCause(ctx.Err())
		}
	}
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

package cli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// CreateSessionOptions are `runner sessions create`'s flags.
type CreateSessionOptions struct {
	Repo   string
	Remote string
	Base   string
	Branch string
	Name   string
	Agent  string
	// Existing checks out Branch instead of cutting a new one from Base.
	Existing bool
}

// CreateSession opens a session: worktree, tmux session, agent in window 0.
func (a *App) CreateSession(ctx context.Context, out io.Writer, opts CreateSessionOptions) error {
	session, err := a.Sessions.Create(ctx, sessionsapp.CreateInput{
		Repo: opts.Repo, Remote: opts.Remote, BaseBranch: opts.Base, Branch: opts.Branch,
		Existing: opts.Existing, Name: opts.Name, Agent: sessionsdomain.Agent(opts.Agent),
	})
	if err != nil {
		return err
	}
	p := newPrinter(out)
	p.printf("session %s (%s)\n", session.ID, session.Name)
	p.printf("branch   %s from %s\n", session.Branch, session.BaseBranch)
	p.printf("worktree %s\n", session.Worktree)
	p.printf("attach   %s sessions attach %s\n", binaryName(), session.ID)
	return p.err
}

// ListSessions prints what this host is running.
func (a *App) ListSessions(ctx context.Context, out io.Writer) error {
	sessions := a.Sessions.List()
	if len(sessions) == 0 {
		p := newPrinter(out)
		p.println("no sessions on this host")
		return p.err
	}
	tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	p := newPrinter(tw)
	p.printf("ID\tSTATE\tAGENT\tREPO\tBRANCH\tWINDOWS\tAGE\n")
	for _, session := range sessions {
		// Refresh live sessions so the state is what the screen says now,
		// not what it said when the runner last looked.
		if session.State.Live() {
			if refreshed, err := a.Sessions.Refresh(ctx, session.ID); err == nil {
				session = refreshed
			}
		}
		p.printf("%s\t%s\t%s\t%s\t%s\t%d\t%s\n", session.ID, session.State, session.Agent,
			session.Repo, session.Branch, len(session.Windows), age(session.Created))
	}
	if p.err != nil {
		return p.err
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	for _, session := range a.Sessions.List() {
		if session.LoginURL != "" {
			if _, err := fmt.Fprintf(out, "\n%s is waiting for a login: %s\n", session.ID, session.LoginURL); err != nil {
				return err
			}
		}
	}
	return nil
}

// AttachSession hands this terminal to tmux. The runner's own PTY streaming
// is for the browser; from a shell on the host, the right answer is to become
// `tmux attach` rather than to proxy bytes through a second process.
func (a *App) AttachSession(id string, window int) error {
	session, err := a.Sessions.Get(id)
	if err != nil {
		return err
	}
	if !session.State.Live() {
		return sessionsdomain.ErrNotRunning.WithDetail(
			"session %s is %s; run `%s sessions restart %s`", id, session.State, binaryName(), id)
	}
	if _, ok := session.Window(window); !ok {
		return sessionsdomain.ErrNotFound.WithDetail("%v: %d", sessionsdomain.ErrNoSuchWindow, window)
	}
	binary, err := exec.LookPath("tmux")
	if err != nil {
		return sessionsdomain.ErrTmux.WithCause(err)
	}
	args := []string{"tmux", "-L", sessionsdomain.Socket, "-f", a.tmuxConfigPath(), "attach-session", "-t", session.Target(window)}
	// Replace this process: the terminal is tmux's from here, and there is
	// nothing left for the runner to do in between.
	return syscall.Exec(binary, args, os.Environ()) //nolint:gosec // binary came from exec.LookPath, arguments built here
}

// RestartSession recreates window 0 in the same worktree.
func (a *App) RestartSession(ctx context.Context, out io.Writer, id string) error {
	session, err := a.Sessions.Restart(ctx, id)
	if err != nil {
		return err
	}
	p := newPrinter(out)
	p.printf("session %s is %s again in %s\n", session.ID, session.State, session.Worktree)
	return p.err
}

// CloseSessionOptions are `runner sessions close`'s flags.
type CloseSessionOptions struct {
	NoPush bool
	Force  bool
}

// CloseSession ends a session: push the branch, remove the worktree.
func (a *App) CloseSession(ctx context.Context, out io.Writer, id string, opts CloseSessionOptions) error {
	session, err := a.Sessions.Close(ctx, id, sessionsapp.CloseInput{Push: !opts.NoPush, Force: opts.Force})
	p := newPrinter(out)
	if err != nil {
		// A kept worktree is worth printing even though the close failed:
		// it is where the person's work still is.
		if session.Worktree != "" && session.State != sessionsdomain.StateClosed {
			p.printf("worktree kept at %s\n", session.Worktree)
		}
		return err
	}
	if opts.NoPush {
		p.printf("session %s closed; the worktree is removed and %s was not pushed\n", session.ID, session.Branch)
	} else {
		p.printf("session %s closed; %s pushed and the worktree removed\n", session.ID, session.Branch)
	}
	return p.err
}

// OpenWindow adds a tab to a session.
func (a *App) OpenWindow(ctx context.Context, out io.Writer, id string) error {
	window, err := a.Sessions.OpenWindow(ctx, id)
	if err != nil {
		return err
	}
	p := newPrinter(out)
	p.printf("window %d opened; attach with `%s sessions attach %s --window %d`\n",
		window.Index, binaryName(), id, window.Index)
	return p.err
}

func (a *App) tmuxConfigPath() string { return a.Paths.Home + "/tmux.conf" }

func binaryName() string {
	executable, err := os.Executable()
	if err != nil {
		return "oppenheimer-runner"
	}
	parts := strings.Split(executable, "/")
	return parts[len(parts)-1]
}

func age(created time.Time) string {
	d := time.Since(created)
	switch {
	case d < time.Minute:
		return strconv.Itoa(int(d.Seconds())) + "s"
	case d < time.Hour:
		return strconv.Itoa(int(d.Minutes())) + "m"
	case d < 24*time.Hour:
		return strconv.Itoa(int(d.Hours())) + "h"
	default:
		return strconv.Itoa(int(d.Hours()/24)) + "d"
	}
}

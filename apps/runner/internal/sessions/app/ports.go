// Package app is the session lifecycle: create, attach, restart, close, adopt.
// tmux, git and the screen classifier are ports, so the lifecycle is one
// readable sequence and each piece of machinery is replaceable and testable.
package app

import (
	"context"
	"io"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Terminals is the tmux server this runner owns.
type Terminals interface {
	// Available reports whether tmux can be used at all.
	Available(ctx context.Context) error
	// Create starts a detached tmux session in dir with window 0 running
	// command (empty for a plain shell), carrying env.
	Create(ctx context.Context, name, dir, command string, env map[string]string) error
	// NewWindow opens another window in the same session and directory and
	// returns its index.
	NewWindow(ctx context.Context, name, dir string) (int, error)
	// KillWindow closes one window.
	KillWindow(ctx context.Context, target string) error
	// Kill ends the whole tmux session.
	Kill(ctx context.Context, name string) error
	// List names the tmux sessions on this server.
	List(ctx context.Context) ([]string, error)
	// Has reports whether one tmux session exists.
	Has(ctx context.Context, name string) (bool, error)
	// Capture returns what the classifier reads: the visible text of a
	// window and the terminal title the program in it has set.
	Capture(ctx context.Context, target string) (Screen, error)
	// Windows lists a session's windows.
	Windows(ctx context.Context, name string) ([]domain.Window, error)
	// SendKeys types into a window.
	SendKeys(ctx context.Context, target, keys string) error
	// Attach runs `tmux attach` on a PTY and returns it. Closing the
	// returned Attachment detaches without touching the session.
	Attach(ctx context.Context, target string, size Size) (Attachment, error)
}

// Size is a terminal's dimensions.
type Size struct {
	Cols uint16
	Rows uint16
}

// Attachment is one PTY attached to a window: the bytes a browser sees.
type Attachment interface {
	io.ReadWriteCloser
	// Resize sets the PTY's size; tmux sizes the window to the smallest
	// attached client.
	Resize(size Size) error
}

// Worktrees is git, at the granularity a session needs.
type Worktrees interface {
	// Ensure makes sure `<root>/<repo>/main` exists and is fetched.
	Ensure(ctx context.Context, repo, remote string) error
	// Add creates a worktree at path, on branch, cut from base.
	Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error
	// Remove deletes a worktree and prunes the record.
	Remove(ctx context.Context, repo, path string, force bool) error
	// Dirty reports uncommitted changes in a worktree.
	Dirty(ctx context.Context, path string) (bool, error)
	// Push publishes the branch, and reports whether there was anything to
	// push at all.
	Push(ctx context.Context, path, branch string) (pushed bool, err error)
}

// Screen is one capture of a window.
type Screen struct {
	// Body is the visible text of the pane.
	Body string
	// Title is what the program set through an OSC escape sequence. It is
	// the most trustworthy signal available: the agent controls it, and
	// nothing a person types into their prompt can appear in it.
	Title string
}

// Classifier turns a captured screen into a state and, when it sees one, the
// vendor login URL the console offers as a button.
type Classifier interface {
	Classify(screen Screen, agent domain.Agent) (domain.State, string)
}

// Store persists the session map across restarts. It is a cache — the control
// plane is the source of truth and tmux is the live registry — that exists so
// a runner which boots before the link comes up still knows which tmux
// session is which.
type Store interface {
	Load() ([]domain.Session, error)
	Save([]domain.Session) error
}

// Publisher receives state changes. The link will forward them to the control
// plane; until it exists, the composition root supplies a logger.
type Publisher interface {
	SessionChanged(session domain.Session)
}

// NopPublisher drops events, for tests and for a runner with no link yet.
type NopPublisher struct{}

// SessionChanged implements Publisher.
func (NopPublisher) SessionChanged(domain.Session) {}

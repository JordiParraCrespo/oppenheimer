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
	// CaptureBody is Capture without the title, for a caller that already
	// has it from Panes.
	CaptureBody(ctx context.Context, target string) (string, error)
	// Panes lists every pane on this server with the fields a refresh
	// needs: one process for the whole host instead of one per session.
	// No server at all is an empty list.
	Panes(ctx context.Context) ([]Pane, error)
	// Windows lists a session's windows.
	Windows(ctx context.Context, name string) ([]domain.Window, error)
	// SendKeys types into a window.
	SendKeys(ctx context.Context, target, keys string) error
	// Paste pastes text into a window as a bracketed paste when the program
	// there asked for one, which is how a dropped file's path reaches an
	// agent in a local terminal. The id names the paste, so two at once
	// never share anything.
	Paste(ctx context.Context, target, id, text string) error
	// Attach runs `tmux attach` on a PTY and returns it. Closing the
	// returned Attachment detaches without touching the session.
	Attach(ctx context.Context, target string, size Size) (Attachment, error)
}

// Pane is one pane of the tmux server, as the poll loop sees it.
type Pane struct {
	// Session is the tmux session name.
	Session string
	Window  int
	Pane    int
	// Active marks the pane a `<session>:<window>` target addresses.
	Active bool
	// Title is what the program in the pane set through an OSC sequence.
	Title string
}

// Size is a terminal's dimensions.
type Size struct {
	Cols uint16
	Rows uint16
}

// Attachment is one PTY attached to a window: the bytes a browser sees.
type Attachment interface {
	io.ReadWriteCloser
	// Resize sets the PTY's size; tmux sizes the window to the client that
	// resized last (`window-size latest`, tmux.Config).
	Resize(size Size) error
}

// Worktrees is git, at the granularity a session needs.
type Worktrees interface {
	// Ensure makes sure the repository's store exists on this host and that
	// ref, the branch a worktree is about to be made from, is fresh in it.
	Ensure(ctx context.Context, repo, remote, ref string) error
	// Add creates a worktree at path, on branch, cut from base.
	Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error
	// Prepare makes the directory this repository's worktrees are created in
	// and answers it, so a terminal can be started there before the worktree
	// itself exists. Add makes it too; this is for the pane that comes first.
	Prepare(ctx context.Context, repo string) (string, error)
	// Remove deletes a worktree and prunes the record.
	Remove(ctx context.Context, repo, path string, force bool) error
	// Dirty reports uncommitted changes in a worktree.
	Dirty(ctx context.Context, path string) (bool, error)
	// Push publishes the branch, and reports whether there was anything to
	// push at all.
	Push(ctx context.Context, path, branch string) (pushed bool, err error)
}

// Images is where a session's pasted images are kept on this host: under the
// runner's own home, never in the worktree, so an agent cannot commit one by
// accident and closing the session can drop them all.
type Images interface {
	// Save writes one image for a session and returns its absolute path.
	Save(sessionID, name string, data []byte) (string, error)
	// Delete removes one image, when the paste it was written for failed.
	Delete(sessionID, name string) error
	// Discard removes every image a session was given.
	Discard(sessionID string) error
}

// Screen is one capture of a window.
type Screen struct {
	// Body is the visible text of the pane.
	Body string
	// Title is what the program set through an OSC escape sequence; why it
	// is the signal to trust is manifest.RegionTitle.
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

// Publisher receives state changes; the link forwards them to the control
// plane.
type Publisher interface {
	SessionChanged(session domain.Session)
}

// NopPublisher drops events: the service's publisher until the link is set.
type NopPublisher struct{}

// SessionChanged implements Publisher.
func (NopPublisher) SessionChanged(domain.Session) {}

// LaunchGate holds an agent's launch while something is replacing that
// agent's executable, so a session never starts a CLI halfway through its
// update. Hold returns once the command may be started, and the release to
// call once it has; it never fails, because a launch late is better than a
// launch refused.
type LaunchGate interface {
	Hold(ctx context.Context, command string) (release func())
}

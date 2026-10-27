// Package app is the session lifecycle: create, attach, restart, close, adopt.
// tmux, git and the screen classifier are ports, so the lifecycle is one
// readable sequence and each piece of machinery is replaceable and testable.
package app

import (
	"context"
	"errors"
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
	// Launch replaces the program in a window with command, run in dir: the
	// program becomes the pane's own process on a fresh screen, and nothing
	// is typed to start it. An empty command is a plain shell.
	Launch(ctx context.Context, target, dir, command string) error
	// Paste pastes text into a window as a bracketed paste when the program
	// there asked for one, which is how a dropped file's path reaches an
	// agent in a local terminal. The id names the paste, so two at once
	// never share anything.
	Paste(ctx context.Context, target, id, text string) error
	// Attach runs `tmux attach` on a PTY and returns it. Closing the
	// returned Attachment detaches without touching the session. A
	// read-only attachment neither types into the pane nor sizes it.
	Attach(ctx context.Context, target string, size Size, readOnly bool) (Attachment, error)
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
	// Redraw asks the client behind this PTY to paint its whole screen again,
	// at the size it already has: what repairs a screen some of whose bytes
	// were lost on the way (the direct path closing mid-stream).
	Redraw() error
}

// Worktrees is git, at the granularity a session needs. A repository's store
// is bare and lives in its workspace's `repos/` (domain.Layout); a session's
// checkout is a worktree of it.
type Worktrees interface {
	// Ensure makes sure the repository's store exists on this host and that
	// ref, the branch a worktree is about to be made from, is fresh in it.
	Ensure(ctx context.Context, repo domain.Repository, remote, ref string) error
	// Has reports whether the repository's store is on this host, whole: the
	// difference between an Ensure that fetches and one that downloads it.
	Has(repo domain.Repository) bool
	// Add creates a worktree at path, on branch, cut from base.
	Add(ctx context.Context, repo domain.Repository, path, branch, base string, newBranch bool) error
	// Remove deletes a worktree and prunes the record. A worktree already gone
	// from disk is only pruned.
	Remove(ctx context.Context, repo domain.Repository, path string, force bool) error
	// Exists reports whether a worktree is still on disk. Someone on the host
	// may have deleted it by hand, and then the session cannot be pushed,
	// kept or restarted, only closed.
	Exists(path string) bool
	// Dirty reports uncommitted changes in a worktree.
	Dirty(ctx context.Context, path string) (bool, error)
	// Push publishes the branch, and reports whether there was anything to
	// push at all.
	Push(ctx context.Context, path, branch string) (pushed bool, err error)
}

// Places is the work folder's own bookkeeping and the folders a session runs
// in (24 §2, §3): what is made, checked and removed around a session, as
// opposed to the git inside it.
type Places interface {
	// MakeSession makes a worktree session's folder (folder.Dir), with its marker
	// (`.oppenheimer/meta.json`) written before anything else goes in, and
	// the account and workspace folders above it with theirs when they are
	// new. A folder this session's marker already names (an earlier attempt
	// at the same create) is taken over; anything else at dir is refused.
	MakeSession(folder domain.SessionFolder) error
	// RemoveSession deletes a session's folder and everything in it, but
	// only when its marker names this session: anything else answers
	// domain.ErrNotOurs and is left as it is. A folder already gone is
	// nothing to do.
	RemoveSession(dir, sessionID string) error
	// CheckFolder reports whether a folder session's folder is usable: an
	// existing directory (domain.ErrNoSuchFolder, domain.ErrNotADirectory).
	// It looks and writes nothing.
	CheckFolder(path string) error
}

// Files is where a session's pasted files are kept on this host: under the
// runner's own home, never in the worktree, so an agent cannot commit one by
// accident and closing the session can drop them all.
type Files interface {
	// Save writes one file for a session and returns its absolute path.
	Save(sessionID, name string, data []byte) (string, error)
	// Delete removes one file, when the paste it was written for failed.
	Delete(sessionID, name string) error
	// Discard removes every file a session was given.
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
	// FirstPrompt carries a session's first message, read off the agent's
	// transcript, to the control plane as `prompt.first` (02-runner §7). It
	// reports whether it took the message, and calls reported once the
	// control plane has it: only then is the session marked reported, so a
	// message offered before the link exists, or lost with the process
	// before it landed, is offered again.
	FirstPrompt(session domain.Session, text string, reported func()) bool
	// DecisionChanged carries what the session's agent now waits on the
	// person for, nil once nothing, to the control plane as `agent.decision`.
	// It is called when the pending decision appears, changes or clears.
	DecisionChanged(session domain.Session, decision *domain.Decision)
}

// Transcripts reads what an agent's own transcript says, on this host. The
// transcript is the CLI's. Two things leave the host from it: the first
// message, at most domain.FirstPromptMaxBytes of it, and, while a browser is
// attached to the session, its entries compacted for the chat view (0.7) —
// what the same browser's terminal already shows.
type Transcripts interface {
	// FirstPrompt is the first message a person sent the agent in the
	// conversation it was launched under, or "" while there is none yet, for
	// an agent whose transcript this runner cannot read, or when the
	// transcript cannot be read at all. It is asked again on the next poll,
	// so a failure is only a later name.
	FirstPrompt(agent domain.Agent, conversation string) string
	// Follow sends the conversation's entries to emit, the history first
	// under Reset and then each one the agent appends, until ctx ends. An
	// entry over entryMax bytes is left out and a batch holds at most
	// batchMax. A batch emit refuses is offered again. ErrNoChat when this
	// runner cannot read the agent's transcript.
	Follow(ctx context.Context, agent domain.Agent, conversation string, entryMax, batchMax int, emit func(ChatBatch) error) error
	// OpenQuestion is the agent's latest AskUserQuestion call that has no
	// result in the transcript yet, as the decision it asks (28-inbox,
	// slice 4); false when there is none, or no transcript to read.
	OpenQuestion(agent domain.Agent, conversation string) (domain.Decision, bool)
}

// ChatBatch is a run of transcript entries for the chat view, each one the
// JSON of one compacted transcript line. Reset starts the history over.
type ChatBatch struct {
	Reset   bool
	Entries []string
}

// ErrNoChat is a session whose agent's transcript this runner cannot follow.
var ErrNoChat = errors.New("no chat for this agent")

// NopPublisher drops events: the service's publisher until the link is set.
type NopPublisher struct{}

// SessionChanged implements Publisher.
func (NopPublisher) SessionChanged(domain.Session) {}

// FirstPrompt implements Publisher: nobody takes it.
func (NopPublisher) FirstPrompt(domain.Session, string, func()) bool { return false }

// DecisionChanged implements Publisher.
func (NopPublisher) DecisionChanged(domain.Session, *domain.Decision) {}

// LaunchGate holds an agent's launch while something is replacing that
// agent's executable, so a session never starts a CLI halfway through its
// update. Hold returns once the command may be started, and the release to
// call once it has; it never fails, because a launch late is better than a
// launch refused.
type LaunchGate interface {
	Hold(ctx context.Context, command string) (release func())
}

// Trust answers an agent's "do you trust this folder?" question before it is
// asked, for every launch: the folder is one the runner made or the person
// picked for the session, so the question only stands between them and the
// agent. It is best-effort: a launch whose folder could not be marked still
// starts, and the question is then on the screen for whoever opens it.
type Trust interface {
	Trust(agent domain.Agent, dir string) error
}

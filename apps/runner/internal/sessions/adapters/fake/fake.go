// Package fake is an in-memory tmux and an in-memory git: the default
// adapters in tests, so the session lifecycle can be exercised on a machine
// that has neither installed and without spawning a process per assertion.
//
// The adapters against the real tools live next door and are exercised by
// their own tests, which skip when the tool is missing. This package is what
// keeps the lifecycle itself fast and deterministic.
package fake

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var (
	_ app.Terminals = (*Terminals)(nil)
	_ app.Worktrees = (*Worktrees)(nil)
)

// Terminals is an in-memory tmux server.
type Terminals struct {
	mu sync.Mutex
	// Missing makes Available fail, standing in for a host without tmux.
	Missing bool
	// Screens is the pane text Capture returns per target; set it to drive
	// the classifier.
	Screens map[string]string
	// Titles is the terminal title per target, the signal an agent sets
	// through an escape sequence.
	Titles map[string]string

	sessions map[string]*fakeSession
	// Attached counts live attachments, so a test can prove that detaching
	// does not end a session.
	Attached int
	// Pastes is every text pasted, in order.
	Pastes []string
	// FailPaste makes the next paste fail, standing in for a window that
	// went away between the save and the paste.
	FailPaste bool
}

// Images is app.Images in memory.
type Images struct {
	mu sync.Mutex
	// Saved is each session's images by name.
	Saved map[string]map[string][]byte
	// Discarded names the sessions whose images were dropped.
	Discarded []string
}

// NewImages returns an empty image store.
func NewImages() *Images { return &Images{Saved: map[string]map[string][]byte{}} }

// Save implements app.Images; the path is a fixed fake root.
func (i *Images) Save(sessionID, name string, data []byte) (string, error) {
	i.mu.Lock()
	defer i.mu.Unlock()
	if i.Saved[sessionID] == nil {
		i.Saved[sessionID] = map[string][]byte{}
	}
	i.Saved[sessionID][name] = append([]byte(nil), data...)
	return "/home/jordi/.oppenheimer/images/" + sessionID + "/" + name, nil
}

// Delete implements app.Images.
func (i *Images) Delete(sessionID, name string) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.Saved[sessionID], name)
	return nil
}

// Discard implements app.Images.
func (i *Images) Discard(sessionID string) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.Saved, sessionID)
	i.Discarded = append(i.Discarded, sessionID)
	return nil
}

type fakeSession struct {
	dir     string
	command string
	env     map[string]string
	windows []domain.Window
	next    int
}

// NewTerminals returns an empty server.
func NewTerminals() *Terminals {
	return &Terminals{
		Screens:  map[string]string{},
		Titles:   map[string]string{},
		sessions: map[string]*fakeSession{},
	}
}

// Available implements app.Terminals.
func (t *Terminals) Available(context.Context) error {
	if t.Missing {
		return domain.ErrTmux.WithDetail("tmux is not installed in this test")
	}
	return nil
}

// Create implements app.Terminals.
func (t *Terminals) Create(_ context.Context, name, dir, command string, env map[string]string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if _, exists := t.sessions[name]; exists {
		return domain.ErrTmuxCommand.WithDetail("duplicate session %q", name)
	}
	t.sessions[name] = &fakeSession{
		dir: dir, command: command, env: env, next: 1,
		windows: []domain.Window{{Index: 0, Name: command, Agent: true}},
	}
	return nil
}

// NewWindow implements app.Terminals.
func (t *Terminals) NewWindow(_ context.Context, name, dir string) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	session, ok := t.sessions[name]
	if !ok {
		return 0, domain.ErrTmuxCommand.WithDetail("no session %q", name)
	}
	index := session.next
	session.next++
	session.windows = append(session.windows, domain.Window{Index: index, Name: "shell"})
	session.dir = dir
	return index, nil
}

// KillWindow implements app.Terminals.
func (t *Terminals) KillWindow(_ context.Context, target string) error {
	name, index, err := splitTarget(target)
	if err != nil {
		return err
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	session, ok := t.sessions[name]
	if !ok {
		return domain.ErrTmuxCommand.WithDetail("no session %q", name)
	}
	kept := session.windows[:0]
	for _, w := range session.windows {
		if w.Index != index {
			kept = append(kept, w)
		}
	}
	session.windows = kept
	return nil
}

// Kill implements app.Terminals. Killing a session that is gone succeeds.
func (t *Terminals) Kill(_ context.Context, name string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.sessions, name)
	return nil
}

// List implements app.Terminals.
func (t *Terminals) List(context.Context) ([]string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	names := make([]string, 0, len(t.sessions))
	for name := range t.sessions {
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

// Has implements app.Terminals.
func (t *Terminals) Has(_ context.Context, name string) (bool, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	_, ok := t.sessions[name]
	return ok, nil
}

// Capture implements app.Terminals.
func (t *Terminals) Capture(_ context.Context, target string) (app.Screen, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	return app.Screen{Body: t.Screens[target], Title: t.Titles[target]}, nil
}

// Windows implements app.Terminals.
func (t *Terminals) Windows(_ context.Context, name string) ([]domain.Window, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	session, ok := t.sessions[name]
	if !ok {
		return nil, domain.ErrTmuxCommand.WithDetail("no session %q", name)
	}
	return append([]domain.Window(nil), session.windows...), nil
}

// SendKeys implements app.Terminals by appending to the screen.
func (t *Terminals) SendKeys(_ context.Context, target, keys string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Screens[target] += keys
	return nil
}

// Paste implements app.Terminals by appending to the screen and recording
// the paste, so a test can tell it from typed keys.
func (t *Terminals) Paste(_ context.Context, target, _ string, text string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.FailPaste {
		t.FailPaste = false
		return domain.ErrTmuxCommand.WithDetail("no window %q", target)
	}
	t.Screens[target] += text
	t.Pastes = append(t.Pastes, text)
	return nil
}

// Attach implements app.Terminals with a pipe that records detaching.
func (t *Terminals) Attach(_ context.Context, target string, _ app.Size) (app.Attachment, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	name, _, err := splitTarget(target)
	if err != nil {
		return nil, err
	}
	if _, ok := t.sessions[name]; !ok {
		return nil, domain.ErrTmuxCommand.WithDetail("no session %q", name)
	}
	t.Attached++
	return &attachment{server: t, screen: t.Screens[target]}, nil
}

// Env exposes the environment a session was created with.
func (t *Terminals) Env(name string) map[string]string {
	t.mu.Lock()
	defer t.mu.Unlock()
	if session, ok := t.sessions[name]; ok {
		return session.env
	}
	return nil
}

// Dir exposes the directory a session was created in.
func (t *Terminals) Dir(name string) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	if session, ok := t.sessions[name]; ok {
		return session.dir
	}
	return ""
}

type attachment struct {
	server *Terminals
	screen string
	read   int
	closed bool
}

func (a *attachment) Read(p []byte) (int, error) {
	if a.read >= len(a.screen) {
		return 0, errors.New("nothing more to read")
	}
	n := copy(p, a.screen[a.read:])
	a.read += n
	return n, nil
}

func (a *attachment) Write(p []byte) (int, error) { return len(p), nil }
func (a *attachment) Resize(app.Size) error       { return nil }

func (a *attachment) Close() error {
	if a.closed {
		return nil
	}
	a.closed = true
	a.server.mu.Lock()
	defer a.server.mu.Unlock()
	a.server.Attached--
	return nil
}

// Worktrees is an in-memory git.
type Worktrees struct {
	mu sync.Mutex
	// Mirrors records the repositories that have been cloned or fetched.
	Mirrors map[string]int
	// Paths records the worktrees that exist.
	Paths map[string]string
	// DirtyPaths makes Dirty answer true for a worktree.
	DirtyPaths map[string]bool
	// PushErr, when set, is what Push returns.
	PushErr error
	// EnsureErr, when set, is what Ensure returns: a clone that failed.
	EnsureErr error
	// Pushed records the branches that reached the remote.
	Pushed []string
}

// NewWorktrees returns an empty git.
func NewWorktrees() *Worktrees {
	return &Worktrees{Mirrors: map[string]int{}, Paths: map[string]string{}, DirtyPaths: map[string]bool{}}
}

// Ensure implements app.Worktrees.
func (w *Worktrees) Ensure(_ context.Context, repo, _ string) error {
	if err := domain.ValidateRepo(repo); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.EnsureErr != nil {
		return w.EnsureErr
	}
	w.Mirrors[repo]++
	return nil
}

// Add implements app.Worktrees.
func (w *Worktrees) Add(_ context.Context, _, path, branch, _ string, _ bool) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, exists := w.Paths[path]; exists {
		return domain.ErrSessionExists.WithDetail("%s already exists", path)
	}
	w.Paths[path] = branch
	return nil
}

// Remove implements app.Worktrees.
func (w *Worktrees) Remove(_ context.Context, _, path string, force bool) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.DirtyPaths[path] && !force {
		return domain.ErrWorktree.WithDetail("%s has uncommitted changes", path)
	}
	delete(w.Paths, path)
	return nil
}

// Dirty implements app.Worktrees.
func (w *Worktrees) Dirty(_ context.Context, path string) (bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.DirtyPaths[path], nil
}

// Push implements app.Worktrees.
func (w *Worktrees) Push(_ context.Context, _, branch string) (bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.PushErr != nil {
		return false, w.PushErr
	}
	w.Pushed = append(w.Pushed, branch)
	return true, nil
}

func splitTarget(target string) (string, int, error) {
	name, index, found := strings.Cut(target, ":")
	if !found {
		return "", 0, domain.ErrTmuxCommand.WithDetail("%q is not a window target", target)
	}
	var n int
	if _, err := fmt.Sscanf(index, "%d", &n); err != nil {
		return "", 0, domain.ErrTmuxCommand.WithDetail("%q is not a window target", target)
	}
	return name, n, nil
}

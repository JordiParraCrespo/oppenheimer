// Package tmux drives one tmux server on a dedicated socket (`tmux -L
// oppenheimer`), so the runner never collides with the user's own tmux and a
// runner restart never touches a session a person started themselves.
//
// The server outlives the runner on purpose: that is what makes sessions
// survive a restart, an update and a rollback (the service units are written
// to stop only the runner process — see internal/service/domain).
package tmux

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Terminals = (*Server)(nil)

// commandTimeout bounds a control command. Attaching is not one of these.
const commandTimeout = 10 * time.Second

// Server is the runner's tmux server.
type Server struct {
	socket string
	binary string
	// config is passed with -f: the runner's own tmux settings, so a
	// session behaves the same whatever the user's ~/.tmux.conf says.
	config string
}

// Options configure the server.
type Options struct {
	// Socket is the `-L` name; defaults to `oppenheimer`.
	Socket string
	// Binary is the tmux executable; defaults to `tmux` on PATH.
	Binary string
	// ConfigPath is where the runner's tmux config is written.
	ConfigPath string
}

// Config is the runner's tmux configuration: no status bar (the console draws
// its own chrome), mouse on, a large scrollback, and no prefix key, because
// every keystroke in the browser belongs to the program in the terminal.
//
// `window-size latest` is what makes a browser's viewport the one that counts.
// tmux sizes a window to fit *every* attached client, so one client left on
// the 80x24 a detached session starts at pins the window there however wide
// the reader's pane is — and the agent, which lays its turn out to the size it
// is told, draws an 80-column block with its prompt on row 21 of 24 while the
// browser shows a grid half as tall again. `latest` hands the window to
// whoever resized last, which is the person actually looking at it.
const Config = `set -g status off
set -g mouse on
set -g history-limit 50000
set -g escape-time 0
set -g focus-events on
set -g default-terminal "xterm-256color"
set -g window-size latest
set -g aggressive-resize on
unbind C-b
set -g prefix None
`

// New builds the server and writes its config.
func New(opts Options) (*Server, error) {
	socket := opts.Socket
	if socket == "" {
		socket = domain.Socket
	}
	binary := opts.Binary
	if binary == "" {
		binary = "tmux"
	}
	s := &Server{socket: socket, binary: binary, config: opts.ConfigPath}
	if s.config != "" {
		if err := os.WriteFile(s.config, []byte(Config), 0o600); err != nil {
			return nil, err
		}
	}
	return s, nil
}

// Available reports whether tmux can be used on this host.
func (s *Server) Available(ctx context.Context) error {
	if _, err := exec.LookPath(s.binary); err != nil {
		return domain.ErrTmux.WithDetail(
			"tmux is how a session survives a disconnect; install it and the runner will pick it up").WithCause(err)
	}
	return nil
}

// args prefixes every invocation with the socket and the config.
//
// `-u` tells tmux the terminal is UTF-8 rather than letting it infer that from
// the locale. A service has no locale to infer from: launchd passes neither
// LANG nor LC_ALL, and a tmux client that cannot prove UTF-8 replaces every
// non-ASCII character it writes with `_`. The pane keeps the real bytes — it
// is the client that downgrades — so a session looked right in `capture-pane`
// and arrived in the browser with an underscore where each agent's turn
// marker, spinner and prompt chevron should be. The unit carries a UTF-8
// locale as well, and this does not depend on it having one.
func (s *Server) args(rest ...string) []string {
	args := []string{"-u", "-L", s.socket}
	if s.config != "" {
		args = append(args, "-f", s.config)
	}
	return append(args, rest...)
}

func (s *Server) run(ctx context.Context, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, commandTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, s.binary, s.args(args...)...) //nolint:gosec // the binary is looked up from PATH and the arguments are built here
	out, err := cmd.CombinedOutput()
	return strings.TrimRight(string(out), "\n"), err
}

func (s *Server) command(ctx context.Context, args ...string) (string, error) {
	out, err := s.run(ctx, args...)
	if err != nil {
		return out, domain.ErrTmuxCommand.WithDetail(
			"tmux %s: %s", strings.Join(args, " "), firstLine(out, err)).WithCause(err)
	}
	return out, nil
}

// Create starts a detached session whose window 0 runs command, or a shell
// when command is empty. The environment is set on the session, so every
// window opened later inherits it.
func (s *Server) Create(ctx context.Context, name, dir, command string, env map[string]string) error {
	args := []string{"new-session", "-d", "-s", name, "-c", dir}
	for key, value := range env {
		args = append(args, "-e", key+"="+value)
	}
	if command != "" {
		args = append(args, command)
	}
	_, err := s.command(ctx, args...)
	return err
}

// NewWindow opens a tab: a plain shell in the same worktree.
func (s *Server) NewWindow(ctx context.Context, name, dir string) (int, error) {
	out, err := s.command(ctx, "new-window", "-t", name+":", "-c", dir, "-P", "-F", "#{window_index}")
	if err != nil {
		return 0, err
	}
	index, convErr := strconv.Atoi(strings.TrimSpace(out))
	if convErr != nil {
		return 0, domain.ErrTmuxCommand.WithDetail("tmux new-window answered %q", out).WithCause(convErr)
	}
	return index, nil
}

// KillWindow closes one window.
func (s *Server) KillWindow(ctx context.Context, target string) error {
	_, err := s.command(ctx, "kill-window", "-t", target)
	return err
}

// Kill ends a session. A session that is already gone is not an error: the
// caller wanted it gone.
func (s *Server) Kill(ctx context.Context, name string) error {
	out, err := s.run(ctx, "kill-session", "-t", name)
	if err == nil || noServer(out) || strings.Contains(out, "can't find session") {
		return nil
	}
	return domain.ErrTmuxCommand.WithDetail("tmux kill-session: %s", firstLine(out, err)).WithCause(err)
}

// List names the sessions on this server. No server at all is an empty list,
// which is the truth on a host that has not opened a session yet.
func (s *Server) List(ctx context.Context) ([]string, error) {
	out, err := s.run(ctx, "list-sessions", "-F", "#{session_name}")
	if err != nil {
		if noServer(out) {
			return nil, nil
		}
		return nil, domain.ErrTmuxCommand.WithDetail("tmux list-sessions: %s", firstLine(out, err)).WithCause(err)
	}
	var names []string
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		if name := strings.TrimSpace(scanner.Text()); name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}

// Has reports whether one session exists.
func (s *Server) Has(ctx context.Context, name string) (bool, error) {
	out, err := s.run(ctx, "has-session", "-t", name)
	if err == nil {
		return true, nil
	}
	if noServer(out) || strings.Contains(out, "can't find session") {
		return false, nil
	}
	return false, domain.ErrTmuxCommand.WithDetail("tmux has-session: %s", firstLine(out, err)).WithCause(err)
}

// Capture returns what the classifier reads: the pane's visible text and the
// title the program in it has set. tmux tracks the title from the OSC
// sequence and hands it over as a format variable, which is the only way to
// get at it — `capture-pane` returns the grid, and the title was never part
// of the grid.
func (s *Server) Capture(ctx context.Context, target string) (app.Screen, error) {
	body, err := s.command(ctx, "capture-pane", "-p", "-t", target)
	if err != nil {
		return app.Screen{}, err
	}
	title, err := s.command(ctx, "display-message", "-p", "-t", target, "#{pane_title}")
	if err != nil {
		// A pane that will not report its title is not a reason to lose the
		// screen we already have.
		return app.Screen{Body: body}, nil //nolint:nilerr // the body is still worth classifying
	}
	return app.Screen{Body: body, Title: strings.TrimSpace(title)}, nil
}

// Windows lists a session's windows, marking window 0 as the agent's.
func (s *Server) Windows(ctx context.Context, name string) ([]domain.Window, error) {
	out, err := s.command(ctx, "list-windows", "-t", name, "-F", "#{window_index} #{window_name}")
	if err != nil {
		return nil, err
	}
	var windows []domain.Window
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		// A window name may contain spaces; the index never does.
		index, windowName, found := strings.Cut(scanner.Text(), " ")
		if !found {
			continue
		}
		n, convErr := strconv.Atoi(strings.TrimSpace(index))
		if convErr != nil {
			continue
		}
		windows = append(windows, domain.Window{Index: n, Name: windowName, Agent: n == 0})
	}
	return windows, nil
}

// SendKeys types into a window. `-l` sends the text literally, so a task
// description containing tmux key names is not interpreted as key names.
func (s *Server) SendKeys(ctx context.Context, target, keys string) error {
	_, err := s.command(ctx, "send-keys", "-t", target, "-l", keys)
	return err
}

// Attach runs `tmux attach` on a PTY. Detaching closes the PTY and leaves the
// session running, which is the difference between a browser closing a tab
// and a session ending.
func (s *Server) Attach(ctx context.Context, target string, size app.Size) (app.Attachment, error) {
	// -d would detach other clients; several devices may watch one window.
	cmd := exec.CommandContext(ctx, s.binary, s.args("attach-session", "-t", target)...) //nolint:gosec // same as run: fixed binary, arguments built here
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	file, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: size.Cols, Rows: size.Rows})
	if err != nil {
		return nil, domain.ErrTmuxCommand.WithDetail("attach %s: %v", target, err).WithCause(err)
	}
	return &attachment{file: file, cmd: cmd}, nil
}

type attachment struct {
	file *os.File
	cmd  *exec.Cmd
}

func (a *attachment) Read(p []byte) (int, error)  { return a.file.Read(p) }
func (a *attachment) Write(p []byte) (int, error) { return a.file.Write(p) }

func (a *attachment) Resize(size app.Size) error {
	return pty.Setsize(a.file, &pty.Winsize{Cols: size.Cols, Rows: size.Rows})
}

// Close detaches: the PTY goes, the tmux session stays.
func (a *attachment) Close() error {
	err := a.file.Close()
	if a.cmd.Process != nil {
		_ = a.cmd.Process.Kill()
		_, _ = a.cmd.Process.Wait()
	}
	if err != nil && !errors.Is(err, os.ErrClosed) {
		return err
	}
	return nil
}

func noServer(out string) bool {
	return strings.Contains(out, "no server running") || strings.Contains(out, "error connecting")
}

func firstLine(out string, err error) string {
	line, _, _ := strings.Cut(strings.TrimSpace(out), "\n")
	if line == "" {
		return fmt.Sprint(err)
	}
	return line
}

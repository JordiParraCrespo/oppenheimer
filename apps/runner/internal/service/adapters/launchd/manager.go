// Package launchd registers the runner as a launchd **user agent** on macOS:
// `~/Library/LaunchAgents/dev.oppenheimer.runner.plist`, bootstrapped into the
// user's GUI domain. Never a LaunchDaemon, never root — a daemon would run the
// user's sessions as someone else, and the whole point of a direct-mode host
// is that the agent is you.
package launchd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Manager = (*Manager)(nil)

// Manager drives `launchctl` in the user's GUI domain.
type Manager struct {
	dir      string
	uid      int
	commands app.Commands
}

// Options configure the manager.
type Options struct {
	// Dir is where user agents live: ~/Library/LaunchAgents.
	Dir string
	// UID is the user's numeric id, the GUI domain launchctl addresses.
	UID int
	// Commands runs launchctl; defaults to execx.
	Commands app.Commands
}

// New builds the manager.
func New(opts Options) *Manager {
	commands := opts.Commands
	if commands == nil {
		commands = execCommands{}
	}
	return &Manager{dir: opts.Dir, uid: opts.UID, commands: commands}
}

// Kind implements app.Manager.
func (m *Manager) Kind() domain.Kind { return domain.KindLaunchd }

// Path is the plist.
func (m *Manager) Path() string { return filepath.Join(m.dir, domain.Label+".plist") }

func (m *Manager) domainTarget() string  { return "gui/" + strconv.Itoa(m.uid) }
func (m *Manager) serviceTarget() string { return m.domainTarget() + "/" + domain.Label }

// Install writes the plist and bootstraps it. An existing job is booted out
// first, because `bootstrap` on a loaded label is an error, and re-running the
// installer has to be a repair rather than a failure.
func (m *Manager) Install(ctx context.Context, unit domain.Unit) error {
	content, err := unit.Render(domain.KindLaunchd)
	if err != nil {
		return domain.ErrInstallFailed.WithDetail("%v", err).WithCause(err)
	}
	if unit.LogDir != "" {
		if err := os.MkdirAll(unit.LogDir, 0o700); err != nil {
			return domain.ErrInstallFailed.WithDetail("create %s: %v", unit.LogDir, err).WithCause(err)
		}
	}
	if err := os.MkdirAll(m.dir, 0o700); err != nil {
		return domain.ErrInstallFailed.WithDetail("create %s: %v", m.dir, err).WithCause(err)
	}
	if err := os.WriteFile(m.Path(), []byte(content), 0o600); err != nil {
		return domain.ErrInstallFailed.WithDetail("write %s: %v", m.Path(), err).WithCause(err)
	}

	_, _ = m.commands.Run(ctx, "launchctl", "bootout", m.serviceTarget())
	if out, err := m.commands.Run(ctx, "launchctl", "bootstrap", m.domainTarget(), m.Path()); err != nil {
		return controlFailed("launchctl bootstrap", out, err)
	}
	if out, err := m.commands.Run(ctx, "launchctl", "enable", m.serviceTarget()); err != nil {
		return controlFailed("launchctl enable", out, err)
	}
	return nil
}

// Uninstall boots the job out and removes the plist.
func (m *Manager) Uninstall(ctx context.Context) error {
	var errs []error
	if out, err := m.commands.Run(ctx, "launchctl", "bootout", m.serviceTarget()); err != nil {
		// "No such process" is the answer on a host where it never ran.
		if !strings.Contains(out, "No such process") && !strings.Contains(out, "not find") {
			errs = append(errs, controlFailed("launchctl bootout", out, err))
		}
	}
	if err := os.Remove(m.Path()); err != nil && !errors.Is(err, os.ErrNotExist) {
		errs = append(errs, domain.ErrControlFailed.WithDetail("remove %s: %v", m.Path(), err).WithCause(err))
	}
	return errors.Join(errs...)
}

// Restart kickstarts the job, which re-executes the `current` symlink and so
// picks up a version that was linked a moment ago.
func (m *Manager) Restart(ctx context.Context) error {
	if out, err := m.commands.Run(ctx, "launchctl", "kickstart", "-k", m.serviceTarget()); err != nil {
		return controlFailed("launchctl kickstart -k", out, err)
	}
	return nil
}

// Status parses the state and pid lines of `launchctl print`.
func (m *Manager) Status(ctx context.Context) (domain.Status, error) {
	status := domain.Status{Kind: domain.KindLaunchd, Path: m.Path()}
	if _, err := os.Stat(m.Path()); err == nil {
		status.Installed = true
	}
	out, err := m.commands.Run(ctx, "launchctl", "print", m.serviceTarget())
	if err != nil {
		// `launchctl print` fails when the label is not loaded, which is a
		// status to report, not an error to propagate.
		status.Detail = "not loaded"
		return status, nil //nolint:nilerr // absence is the answer here
	}
	status.Detail = "loaded"
	for _, line := range strings.Split(out, "\n") {
		field := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(field, "state = "):
			state := strings.TrimPrefix(field, "state = ")
			status.Detail = state
			status.Running = strings.Contains(state, "running")
		case strings.HasPrefix(field, "pid = "):
			status.Running = true
		}
	}
	return status, nil
}

func controlFailed(command, out string, err error) error {
	detail := strings.TrimSpace(out)
	if detail == "" {
		detail = err.Error()
	}
	return domain.ErrControlFailed.WithDetail("%s: %s", command, detail).WithCause(err)
}

// commandTimeout bounds one launchctl call. `kickstart -k` waits for the old
// process to exit, and launchd's default exit timeout is 20 seconds before it
// sends SIGKILL: a call that has not returned in a minute is launchd wedged,
// and `runner install`, `update` and `uninstall` must not hang with it.
const commandTimeout = 60 * time.Second

// execCommands is the real process runner.
type execCommands struct {
	// timeout bounds each call; zero is commandTimeout.
	timeout time.Duration
}

func (c execCommands) Run(ctx context.Context, name string, args ...string) (string, error) {
	timeout := c.timeout
	if timeout <= 0 {
		timeout = commandTimeout
	}
	res, err := execx.Run(ctx, execx.Spec{Name: name, Args: args, Timeout: timeout, Output: execx.Combined})
	var failed *execx.Error
	switch {
	case errors.As(err, &failed) && failed.TimedOut:
		return res.Out, fmt.Errorf("%s timed out after %s: %w", name, timeout, execx.Cause(err))
	case err != nil:
		return res.Out, fmt.Errorf("%s: %w", name, execx.Cause(err))
	}
	return res.Out, nil
}

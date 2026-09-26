// Package systemd registers the runner as a systemd **user** unit on Debian
// and Ubuntu: `~/.config/systemd/user/oppenheimer-runner.service`, owned by
// the user, never a system unit and never root.
//
// It also turns on lingering, without which a user unit exists only while
// that user is logged in — which is not what "my Hetzner box" means. Lingering
// needs privileges the runner may not have; that is reported as a warning on
// the status, never as a failed install.
package systemd

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
)

var _ app.Manager = (*Manager)(nil)

// Manager drives `systemctl --user`.
type Manager struct {
	dir      string
	user     string
	commands app.Commands
}

// Options configure the manager.
type Options struct {
	// Dir is where user units live; defaults to ~/.config/systemd/user.
	Dir string
	// User is whose lingering is enabled.
	User string
	// Commands runs systemctl and loginctl; defaults to os/exec.
	Commands app.Commands
}

// New builds the manager.
func New(opts Options) *Manager {
	commands := opts.Commands
	if commands == nil {
		commands = execCommands{}
	}
	return &Manager{dir: opts.Dir, user: opts.User, commands: commands}
}

// Kind implements app.Manager.
func (m *Manager) Kind() domain.Kind { return domain.KindSystemd }

// Path is the unit file.
func (m *Manager) Path() string { return filepath.Join(m.dir, domain.SystemdUnit) }

// Install writes the unit, reloads, enables it and (re)starts it.
func (m *Manager) Install(ctx context.Context, unit domain.Unit) error {
	content, err := unit.Render(domain.KindSystemd)
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
	// Lingering first: a unit enabled before lingering is on would not come
	// back after a reboot until the user logged in.
	if m.user != "" {
		if _, err := m.commands.Run(ctx, "loginctl", "enable-linger", m.user); err != nil {
			// Reported by Status, not fatal: the service still runs now.
			_ = err
		}
	}
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "daemon-reload"); err != nil {
		return controlFailed("systemctl --user daemon-reload", out, err)
	}
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "enable", domain.SystemdUnit); err != nil {
		return controlFailed("systemctl --user enable", out, err)
	}
	// Restart, not `enable --now`: `--now` leaves a unit that is already
	// running alone, so re-running the installer on a paired host would link
	// the new release and keep executing the old one until the next update.
	// Restart starts a stopped unit too, and leaves tmux up (KillMode=process).
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "restart", domain.SystemdUnit); err != nil {
		return controlFailed("systemctl --user restart", out, err)
	}
	return nil
}

// Uninstall stops and disables the unit and removes the file.
func (m *Manager) Uninstall(ctx context.Context) error {
	var errs []error
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "disable", "--now", domain.SystemdUnit); err != nil {
		if !strings.Contains(out, "not loaded") && !strings.Contains(out, "No such file") {
			errs = append(errs, controlFailed("systemctl --user disable --now", out, err))
		}
	}
	if err := os.Remove(m.Path()); err != nil && !errors.Is(err, os.ErrNotExist) {
		errs = append(errs, domain.ErrControlFailed.WithDetail("remove %s: %v", m.Path(), err).WithCause(err))
	}
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "daemon-reload"); err != nil {
		errs = append(errs, controlFailed("systemctl --user daemon-reload", out, err))
	}
	return errors.Join(errs...)
}

// Restart is what an update calls: the unit's ExecStart is the `current`
// symlink, so restarting is all that is needed to run a new version.
func (m *Manager) Restart(ctx context.Context) error {
	if out, err := m.commands.Run(ctx, "systemctl", "--user", "restart", domain.SystemdUnit); err != nil {
		return controlFailed("systemctl --user restart", out, err)
	}
	return nil
}

// Status reports whether the unit is installed, active, and durable.
func (m *Manager) Status(ctx context.Context) (domain.Status, error) {
	status := domain.Status{Kind: domain.KindSystemd, Path: m.Path()}
	if _, err := os.Stat(m.Path()); err == nil {
		status.Installed = true
	}
	out, _ := m.commands.Run(ctx, "systemctl", "--user", "is-active", domain.SystemdUnit)
	state := strings.TrimSpace(out)
	status.Running = state == "active"
	status.Detail = state
	if status.Installed && m.user != "" {
		if lingering, _ := m.commands.Run(ctx, "loginctl", "show-user", m.user, "--property=Linger"); !strings.Contains(lingering, "Linger=yes") {
			status.Detail = strings.TrimSpace(state + "; lingering is off, so the runner stops when you log out — run: loginctl enable-linger " + m.user)
		}
	}
	return status, nil
}

func controlFailed(command, out string, err error) error {
	detail := strings.TrimSpace(out)
	if detail == "" {
		detail = err.Error()
	}
	// The commonest failure on a fresh box is a login with no user session
	// bus — over `su`, in a container, or on a host where the user has never
	// logged in properly. The message systemd gives for it explains nothing.
	if strings.Contains(detail, "Failed to connect to bus") {
		detail += "\n  this login has no systemd user session. Log in over SSH as this user" +
			" (not via su), or have an administrator run: loginctl enable-linger " + userHint()
	}
	return domain.ErrControlFailed.WithDetail("%s: %s", command, detail).WithCause(err)
}

// userHint names the account in the fix-it line when we know it.
func userHint() string {
	if name := os.Getenv("USER"); name != "" {
		return name
	}
	return "<your user>"
}

// execCommands is the real process runner.
type execCommands struct{}

func (execCommands) Run(ctx context.Context, name string, args ...string) (string, error) {
	out, err := exec.CommandContext(ctx, name, args...).CombinedOutput()
	return string(out), err
}

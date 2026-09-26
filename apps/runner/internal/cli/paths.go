// Package cli is the composition root for everything the runner does outside
// the HTTP server: the subcommands a person types and the installer runs. It
// is the CLI's counterpart to internal/server, and the only other place that
// names concrete adapters.
package cli

import (
	"os"
	"path/filepath"
	"strings"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// Directory names under the runner home. They are the layout note 02 §11
// describes, and nothing outside this file decides where a file goes.
const (
	DirBin   = "bin"
	DirLog   = "log"
	DirRun   = "run"
	DirState = "state"
	// DirManifests holds agent manifests newer than the ones compiled in.
	// The control plane writes here; an empty directory is the normal case
	// and means the bundled rules are in force.
	DirManifests = "manifests"
	// DirImages holds the pictures pasted into sessions' prompts, one
	// directory per session, dropped when the session closes.
	DirImages = "images"
)

// Paths resolves every location the runner uses on a host.
type Paths struct {
	// Home is ~/.oppenheimer: identity, binaries, logs, sockets. Never the
	// user's code, which lives under Workspaces and is never touched by an
	// uninstall.
	Home string
	// UserHome is the account's home directory.
	UserHome string
	// Workspaces is where sessions' checkouts live: ~/oppenheimer-ai/workspaces
	// unless the user chose another directory at install (saved in
	// config.json) or RUNNER_WORKSPACES says otherwise.
	Workspaces string
	// WorkspacesSource says which of those three decided Workspaces, for
	// `status` and `workspaces`: "env", "config" or "default".
	WorkspacesSource string
}

// Environment variables that move the layout, for development and for tests.
const (
	EnvHome       = "RUNNER_HOME"
	EnvWorkspaces = "RUNNER_WORKSPACES"
)

// ResolvePaths builds the layout, honouring RUNNER_HOME so a second runner
// can be developed on a machine that already hosts one.
func ResolvePaths() (Paths, error) {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return Paths{}, err
	}
	home := os.Getenv(EnvHome)
	if home == "" {
		home = filepath.Join(userHome, ".oppenheimer")
	}
	workspaces, source := os.Getenv(EnvWorkspaces), "env"
	if workspaces == "" {
		workspaces, source = DefaultWorkspaces(userHome), "default"
	}
	return Paths{Home: home, UserHome: userHome, Workspaces: workspaces, WorkspacesSource: source}, nil
}

// DefaultWorkspaces is where sessions live when nobody chose otherwise.
func DefaultWorkspaces(userHome string) string {
	return filepath.Join(userHome, "oppenheimer-ai", "workspaces")
}

// syncedFolders are directories a desktop sync client owns. A git worktree an
// agent is writing into, synced mid-write to another machine, is how a repo
// ends up with conflicted copies of its own index.
var syncedFolders = []string{
	"Library/Mobile Documents", "Library/CloudStorage", "Dropbox", "Google Drive", "OneDrive",
}

// ChooseWorkspaces turns a directory a person asked for into one sessions can
// live in, or says why it cannot be. It creates the directory (0700) when it
// is missing, and answers the symlink-resolved path, because git writes
// absolute paths into every worktree and a symlink that later moves would
// strand them. Warnings are for things that work but will hurt.
func ChooseWorkspaces(raw string, p Paths) (dir string, warnings []string, err error) {
	dir = strings.TrimSpace(raw)
	switch {
	case dir == "~":
		dir = p.UserHome
	case strings.HasPrefix(dir, "~/"):
		dir = filepath.Join(p.UserHome, dir[2:])
	}
	if !filepath.IsAbs(dir) {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail("%q is not an absolute path", raw)
	}
	dir = filepath.Clean(dir)
	if dir == "/" || dir == filepath.Clean(p.UserHome) {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail(
			"%s would scatter repositories through a directory that holds other things; choose one of its own, such as %s",
			dir, DefaultWorkspaces(p.UserHome))
	}
	// Checked on the path as typed before anything is created, and again on
	// the resolved path below, so a refusal never leaves a directory behind.
	if within(dir, filepath.Clean(p.Home)) {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail(
			"%s is inside %s, which holds the runner's own files; choose a directory outside it", dir, p.Home)
	}
	if _, statErr := os.Stat(dir); os.IsNotExist(statErr) {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return "", nil, hostdomain.ErrWorkspaces.WithDetail("cannot create %s: %v", dir, err)
		}
	}
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail("%s is not a directory", dir)
	}
	probe, err := os.CreateTemp(dir, ".oppenheimer-probe-*")
	if err != nil {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail("%s is not writable by this account: %v", dir, err)
	}
	_ = probe.Close()
	_ = os.Remove(probe.Name())
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	home := filepath.Clean(p.Home)
	if resolved, err := filepath.EvalSymlinks(home); err == nil {
		home = resolved
	}
	if within(dir, home) {
		return "", nil, hostdomain.ErrWorkspaces.WithDetail(
			"%s is inside %s, which holds the runner's own files; choose a directory outside it", dir, p.Home)
	}
	for _, synced := range syncedFolders {
		if strings.Contains(dir+string(filepath.Separator), string(filepath.Separator)+synced+string(filepath.Separator)) {
			warnings = append(warnings, dir+" is inside a synced folder ("+synced+"); syncing git worktrees while an agent writes to them causes conflicts")
			break
		}
	}
	return dir, warnings, nil
}

// within reports whether dir is root or somewhere below it.
func within(dir, root string) bool {
	return dir == root || strings.HasPrefix(dir+string(filepath.Separator), root+string(filepath.Separator))
}

// Bin is the versioned binary directory.
func (p Paths) Bin() string { return filepath.Join(p.Home, DirBin) }

// Current is the symlink the service unit executes.
func (p Paths) Current() string { return filepath.Join(p.Bin(), "current") }

// Log is the log directory.
func (p Paths) Log() string { return filepath.Join(p.Home, DirLog) }

// Run holds the socket and the single-instance lock.
func (p Paths) Run() string { return filepath.Join(p.Home, DirRun) }

// State holds update.json.
func (p Paths) State() string { return filepath.Join(p.Home, DirState) }

// Manifests is where newer agent manifests are dropped.
func (p Paths) Manifests() string { return filepath.Join(p.Home, DirManifests) }

// Images is where pasted images are kept.
func (p Paths) Images() string { return filepath.Join(p.Home, DirImages) }

// Socket is the local Unix socket: the runner's only listener.
func (p Paths) Socket() string { return filepath.Join(p.Run(), "runner.sock") }

// Lock is the single-instance lock file.
func (p Paths) Lock() string { return filepath.Join(p.Run(), "runner.lock") }

// Ensure creates the directories the runner owns, 0700 — everything it holds
// is either a secret or a log of what the user's agent is doing.
func (p Paths) Ensure() error {
	for _, dir := range []string{p.Home, p.Bin(), p.Log(), p.Run(), p.State(), p.Manifests()} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	return nil
}

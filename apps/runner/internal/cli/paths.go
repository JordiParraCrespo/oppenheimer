// Package cli is the composition root for everything the runner does outside
// the HTTP server: the subcommands a person types and the installer runs. It
// is the CLI's counterpart to internal/server, and the only other place that
// names concrete adapters.
package cli

import (
	"os"
	"path/filepath"
)

// Directory names under the runner home. They are the layout note 02 §11
// describes, and nothing outside this file decides where a file goes.
const (
	DirBin   = "bin"
	DirLog   = "log"
	DirRun   = "run"
	DirState = "state"
)

// Paths resolves every location the runner uses on a host.
type Paths struct {
	// Home is ~/.oppenheimer: identity, binaries, logs, sockets. Never the
	// user's code, which lives under Workspaces and is never touched by an
	// uninstall.
	Home string
	// UserHome is the account's home directory.
	UserHome string
	// Workspaces is ~/oppenheimer-ai/workspaces.
	Workspaces string
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
	workspaces := os.Getenv(EnvWorkspaces)
	if workspaces == "" {
		workspaces = filepath.Join(userHome, "oppenheimer-ai", "workspaces")
	}
	return Paths{Home: home, UserHome: userHome, Workspaces: workspaces}, nil
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

// Socket is the local Unix socket: the runner's only listener.
func (p Paths) Socket() string { return filepath.Join(p.Run(), "runner.sock") }

// Lock is the single-instance lock file.
func (p Paths) Lock() string { return filepath.Join(p.Run(), "runner.lock") }

// Ensure creates the directories the runner owns, 0700 — everything it holds
// is either a secret or a log of what the user's agent is doing.
func (p Paths) Ensure() error {
	for _, dir := range []string{p.Home, p.Bin(), p.Log(), p.Run(), p.State()} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	return nil
}

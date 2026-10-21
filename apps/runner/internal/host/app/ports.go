// Package app holds the host inventory use case and the ports it needs. The
// ports exist so the use case can be tested without a machine: every call
// that touches the operating system goes through Prober.
package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// Prober is the operating system, as much of it as this context needs.
type Prober interface {
	// Platform identifies the host family and its version string.
	Platform(ctx context.Context) (domain.Platform, string, error)
	// Tool locates an executable and reads its version. A tool that is not
	// on PATH is returned with an empty Path and no error: absence is an
	// answer, not a failure. The answer may be cached while the executable
	// is unchanged.
	Tool(ctx context.Context, name string) domain.Tool
	// Invalidate drops whatever the prober cached, so the next call asks the
	// machine again: what a preflight means.
	Invalidate()
	// Identity reports who the runner runs as.
	Identity() (user, home, hostname string, root bool)
	// DiskFree reports free bytes on the filesystem holding path. It takes
	// the nearest existing ancestor when the path is not there yet.
	DiskFree(path string) (uint64, error)
	// DiskTotal reports the size of the filesystem holding path, resolved the
	// same way DiskFree resolves it.
	DiskTotal(path string) (uint64, error)
	// Machine reports what the operating system says about the hardware and
	// itself. Fields it cannot read are left empty; it never fails.
	Machine(ctx context.Context) domain.Machine
}

// Updater runs an agent CLI's own updater: the executable at path with args,
// and env on top of the runner's own environment, bounded by
// domain.AgentUpdateTimeout, with no terminal and nothing on stdin. tool is the probed name ("claude"), which is what anything that
// must not start the CLI mid-update waits on. A failure's message is the
// reason, fit to show a person.
type Updater interface {
	Update(ctx context.Context, tool, path string, args, env []string) error
}

// Installer runs a catalog install script for tool: `sh -c script`, as the
// runner's own account, bounded by domain.ToolInstallTimeout, with no
// terminal and nothing on stdin. A failure's message is the reason, fit to
// show a person.
type Installer interface {
	Install(ctx context.Context, tool, script string) error
}

// Directories is the host's file system, as far as the folder picker reads
// it: directory names and the branch a checkout is on, never a file's name
// and never what a file holds.
type Directories interface {
	// Subdirectories names dir's sub-directories, symlinks to directories
	// included, in no order. A dir that is not there answers fs.ErrNotExist,
	// one that cannot be read fs.ErrPermission, and a path that is something
	// else domain.ErrNotADirectory.
	Subdirectories(dir string) ([]string, error)
	// Branch is the branch the git checkout at dir is on, a short commit id
	// when it is detached, or "" when dir is no checkout. It reads what git
	// wrote and never runs git: a listing asks it once per directory shown.
	Branch(dir string) string
}

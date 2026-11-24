// Package app holds the host inventory use case and the ports it needs. The
// ports exist so the use case can be tested without a machine: every call
// that touches the operating system goes through Prober.
package app

import (
	"context"
	"image"

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

// ExecPolicies is where the host keeps what it lets bots run: a file only
// the person on the host writes (`runner exec`). Load answers the default,
// off, when nothing was ever saved.
type ExecPolicies interface {
	Load() (domain.ExecPolicy, error)
	Save(domain.ExecPolicy) error
}

// Executor runs one program to completion for a bot: argv directly, no
// shell, stdin empty, its whole process group killed at the timeout, each
// stream cut to its last limit bytes. A program that could not be started
// is an error; one that ran and failed is a result with its exit code.
type Executor interface {
	Run(ctx context.Context, req domain.ExecRequest) (domain.ExecResult, error)
}

// ComputerPolicies is where the host keeps whether bots may use its screen:
// a file only the person on the host writes (`runner computer`). Load
// answers the default, off, when nothing was ever saved.
type ComputerPolicies interface {
	Load() (domain.ComputerPolicy, error)
	Save(domain.ComputerPolicy) error
}

// BrowserPolicies is where the host keeps whether bots may drive a browser
// on it: a file only the person on the host writes (`runner browser`). Load
// answers the default, off, when nothing was ever saved.
type BrowserPolicies interface {
	Load() (domain.BrowserPolicy, error)
	Save(domain.BrowserPolicy) error
}

// Browsers is the bots' browsers on this host: one each, started on a bot's
// first open and kept between its actions. A host with no browser to start
// answers an error that wraps domain.ErrNoBrowser; a ref the page no longer
// has, domain.ErrBrowserRef; an action before any page, domain.ErrBrowserNotOpen.
type Browsers interface {
	// Act does one action and answers with the page after it.
	Act(ctx context.Context, req domain.BrowserRequest) (domain.BrowserPage, error)
	// Available says which browser would be started, or why none can be.
	Available() (string, error)
	// CloseAll ends every browser that is open.
	CloseAll()
}

// Desktop is the host's screen, mouse and keyboard. A host with none it can
// reach answers an error that wraps domain.ErrNoScreen, with what is missing;
// any other error is a screen that is there and could not be read or used.
type Desktop interface {
	// Screen is the screen's size in the units Act points in.
	Screen(ctx context.Context) (domain.Screen, error)
	// Capture is what the screen shows now, at whatever size it is drawn.
	Capture(ctx context.Context) (image.Image, error)
	// Act does one action, its coordinates already in Screen's units. It is
	// never asked to take a screenshot or to wait.
	Act(ctx context.Context, req domain.ComputerRequest) error
}

package cli

import (
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/controlplane"
	pairfile "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/file"
	pairtoken "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/token"
	pairapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/adapters/launchd"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/adapters/systemd"
	svcapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	svcdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionstate "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/binaries"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/release"
	updstate "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/state"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
)

// App is the assembled host agent: the contexts a subcommand needs, wired to
// real adapters. Nothing below this file knows which adapter it got.
type App struct {
	Paths   Paths
	Version string

	Host    *hostapp.Service
	Pairing *pairapp.Service
	Service *svcapp.Service
	// Sessions is the worktree-plus-tmux lifecycle.
	Sessions *sessionsapp.Service
	// Updates is nil on a host that is not paired: the release URL and the
	// channel come from the identity, so there is nothing to build from.
	Updates *updapp.Service
	// Binaries is the versioned layout, exposed for `status`.
	Binaries *binaries.Store
	// StatePath is update.json's location, for `status`.
	StatePath string
	// UnitPath is the service unit's location, for `status` and `uninstall`.
	UnitPath string
	// Terminals is the tmux server, exposed so `sessions attach` can hand
	// the terminal over to tmux directly.
	Terminals *tmux.Server
	// Link is the control-plane link while `run` holds one, for `status`.
	Link *link.Client
	// Credentials answers the git credential helper while `run` holds a link.
	Credentials *credentialBroker
}

// New wires the host agent. It reads the identity when there is one, which is
// what decides whether the update context exists at all.
func New(version string) (*App, error) {
	paths, err := ResolvePaths()
	if err != nil {
		return nil, err
	}
	if err := paths.Ensure(); err != nil {
		return nil, err
	}

	store := pairfile.New(paths.Home)
	// The directory the user chose at install lives in config.json; the
	// environment still wins, which is how a second runner is developed on a
	// machine that already hosts one. Read before anything that is built on
	// the workspace root, so the daemon, `status` and `sessions` agree on it.
	if paths.WorkspacesSource != "env" {
		if identity, _, err := store.Load(); err == nil && identity.WorkspacesPath != "" {
			paths.Workspaces, paths.WorkspacesSource = identity.WorkspacesPath, "config"
		}
	}

	hostSvc := hostapp.New(hostapp.Options{
		Prober: system.New(), WorkspaceRoot: paths.Workspaces, Version: version,
	})
	pairingSvc := pairapp.New(pairapp.Options{
		Store:        store,
		ControlPlane: controlplane.New(controlplane.Options{UserAgent: "oppenheimer-runner/" + version}),
		Signer:       pairtoken.New(),
		Unsealer:     pairtoken.Unsealer{},
	})

	manager := serviceManager(paths)
	serviceSvc := svcapp.New(svcapp.Options{Manager: manager, Unit: unit(paths)})

	app := &App{
		Paths: paths, Version: version,
		Host: hostSvc, Pairing: pairingSvc, Service: serviceSvc,
		StatePath: filepath.Join(paths.State(), updstate.FileName),
	}
	if manager != nil {
		app.UnitPath = manager.Path()
	}

	terminals, err := tmux.New(tmux.Options{ConfigPath: filepath.Join(paths.Home, "tmux.conf")})
	if err != nil {
		return nil, err
	}
	layout := sessionsdomain.Layout{Root: paths.Workspaces}
	sessions, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals,
		Worktrees: gitadapter.New(gitadapter.Options{
			Layout: layout,
			// git asks the runner over the local socket when it needs a
			// token; nothing is written to disk and nothing is passed on a
			// command line.
			CredentialHelper: credentialHelper(),
		}),
		Classifier: manifest.New(manifest.Options{Dir: paths.Manifests()}),
		Store:      sessionstate.New(paths.State()),
		Layout:     layout,
		Env: func(session sessionsdomain.Session) map[string]string {
			return map[string]string{
				"OPPENHEIMER_SESSION": session.ID,
				"OPPENHEIMER_SOCKET":  paths.Socket(),
				"OPPENHEIMER_REPO":    session.Repo,
			}
		},
	})
	if err != nil {
		return nil, err
	}
	app.Sessions = sessions
	app.Terminals = terminals

	binStore, err := binaries.New(binaries.Options{
		Dir: paths.Bin(), Name: "runner", HTTP: &http.Client{Timeout: 10 * time.Minute},
	})
	if err != nil {
		return nil, err
	}
	app.Binaries = binStore

	// The update context needs the identity: a host that is not paired has
	// no release URL, no channel and nothing to update towards.
	if identity, err := pairingSvc.Identity(); err == nil {
		app.Updates = updapp.New(updapp.Options{
			Releases: release.New(release.Options{BaseURL: releaseBaseURL(identity)}),
			Binaries: binStore,
			// Restarting the service is how a new binary starts running.
			Restarter: serviceSvc,
			State:     updstate.New(paths.State()),
			Version:   version,
			Channel:   string(identity.Channel),
			Pinned:    identity.PinnedVersion,
		})
	}
	return app, nil
}

// DefaultReleaseBaseURL is where signed releases live when a control plane
// did not name one at registration.
const DefaultReleaseBaseURL = "https://get.oppenheimer.dev/releases"

func releaseBaseURL(identity pairdomain.Identity) string {
	if identity.ReleaseBaseURL != "" {
		return identity.ReleaseBaseURL
	}
	return DefaultReleaseBaseURL
}

// serviceManager picks the init system. An unsupported platform gets a nil
// manager, and every service use case reports SVC_001 rather than pretending.
func serviceManager(paths Paths) svcapp.Manager {
	switch runtime.GOOS {
	case "darwin":
		return launchd.New(launchd.Options{
			Dir: filepath.Join(paths.UserHome, "Library", "LaunchAgents"),
			UID: os.Getuid(),
		})
	case "linux":
		return systemd.New(systemd.Options{
			Dir:  filepath.Join(paths.UserHome, ".config", "systemd", "user"),
			User: accountName(),
		})
	default:
		return nil
	}
}

// unit is the service unit this host would install. It executes the `current`
// symlink, never a versioned path, so an update is a symlink swap plus a
// restart.
func unit(paths Paths) svcdomain.Unit {
	env := map[string]string{}
	if home := os.Getenv(EnvHome); home != "" {
		env[EnvHome] = home
	}
	if workspaces := os.Getenv(EnvWorkspaces); workspaces != "" {
		env[EnvWorkspaces] = workspaces
	}
	// The PATH the installer was run with, carried onto the service.
	//
	// launchd hands a job `/usr/bin:/bin:/usr/sbin:/sbin` and systemd little
	// more, and neither contains `/opt/homebrew/bin` — so on a stock Homebrew
	// Mac the installed runner cannot see tmux, git or the agent, and every
	// session fails with "a required tool is missing" while `runner status`,
	// which inherits the caller's shell, reports all of them present. Taking
	// the PATH from the install is what makes those two agree: the tools the
	// installer verified are the tools the service can reach.
	if path := ServicePATH(os.Getenv("PATH")); path != "" {
		env["PATH"] = path
	}
	// A UTF-8 locale, for the same reason and from the same gap: launchd and
	// systemd pass none, and a tmux client without one writes `_` in place of
	// every non-ASCII character. `-u` already forces tmux's hand; this is for
	// everything else a session runs, which reads the locale the ordinary way.
	env["LANG"] = utf8Locale(os.Getenv("LANG"))
	env["LC_ALL"] = utf8Locale(os.Getenv("LC_ALL"))
	return svcdomain.Unit{
		ExecPath:   paths.Current(),
		Args:       []string{"run"},
		WorkingDir: paths.UserHome,
		LogDir:     paths.Log(),
		Env:        env,
		User:       accountName(),
	}
}

// ServicePATH is the installer's PATH as the service should carry it: only
// absolute entries, each once. An empty entry or a relative one (`.`, `bin`)
// means "the current directory" to a shell, and the service's current
// directory is the user's home — so a PATH with one would let a file dropped
// there shadow git or tmux for every session. It is dropped rather than
// resolved, because what it meant at install is not what it would mean later.
func ServicePATH(path string) string {
	seen := map[string]bool{}
	var kept []string
	for _, entry := range filepath.SplitList(path) {
		if entry == "" || !filepath.IsAbs(entry) || seen[entry] {
			continue
		}
		seen[entry] = true
		kept = append(kept, entry)
	}
	return strings.Join(kept, string(os.PathListSeparator))
}

// utf8Locale keeps a locale that already names UTF-8 and otherwise answers one
// that does. An installer run from a terminal usually has a good value; a
// package manager's post-install hook often has none, and "no locale" is the
// case that has to come out right.
func utf8Locale(current string) string {
	if strings.Contains(strings.ToUpper(current), "UTF-8") ||
		strings.Contains(strings.ToUpper(current), "UTF8") {
		return current
	}
	return "C.UTF-8"
}

// credentialHelper is the command git calls for a password: this binary's own
// subcommand, resolved to an absolute path so git finds it whatever PATH a
// session's shell ends up with.
func credentialHelper() string {
	executable, err := os.Executable()
	if err != nil {
		return ""
	}
	return executable + " credential-helper"
}

// accountName is the account the runner runs as. os/user is the source of
// truth: $USER is unset under a service manager and wrong under `sudo -u`,
// and `loginctl enable-linger` needs a real name.
func accountName() string {
	if u, err := user.Current(); err == nil && u.Username != "" {
		return u.Username
	}
	if name := os.Getenv("USER"); name != "" {
		return name
	}
	return os.Getenv("LOGNAME")
}

// RequiredTools is re-exported for the status output, so the CLI does not
// reach into another context's domain for a constant.
var RequiredTools = hostdomain.RequiredTools

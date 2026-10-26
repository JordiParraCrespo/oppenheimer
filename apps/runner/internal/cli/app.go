package cli

import (
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"

	devapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/folders"
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
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/agenttrust"
	filestore "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/files"
	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionstate "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/workfolder"
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
	// StatePath is update.json's location.
	StatePath string
	// UnitPath is the service unit's location.
	UnitPath string
	// Terminals is the runner's tmux server.
	Terminals *tmux.Server
	// Worktrees is the sessions' git, kept for waiting on the spare worktree
	// it makes after a create (CreateSession).
	Worktrees *gitadapter.Client
	// WorkFolder is the work folder's own bookkeeping: its layout file and
	// the markers of the folders the runner makes there.
	WorkFolder *workfolder.Folder
	// Link is the control-plane link while `run` holds one.
	Link *link.Client
	// Credentials answers the git credential helper while `run` holds a link.
	Credentials *credentialBroker
	// Devices is the simulators and emulators this host offers its sessions,
	// one each; nil is a host that offers none.
	Devices *devapp.Service

	// downloads keeps the runner's own update check and a round of agent
	// updates from running at once: two downloads on one link, and a
	// self-update restart landing in the middle of an agent's install.
	downloads sync.Mutex
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

	// Before anything probes or starts tmux: the directories the catalog's
	// installers write to, so a CLI the runner installed is on the PATH of
	// the probe, the service and every session.
	if err := os.Setenv("PATH", WithInstallBins(os.Getenv("PATH"), paths.UserHome)); err != nil {
		return nil, err
	}
	hostSvc := hostapp.New(hostapp.Options{
		Prober:        system.New(),
		Updater:       lockedUpdater{paths: paths, next: system.Updater{}},
		Installer:     lockedInstaller{paths: paths, next: system.Installer{}},
		Directories:   folders.Disk{},
		WorkspaceRoot: paths.Workspaces, Version: version,
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
	places := workfolder.New(workfolder.Options{Layout: layout})
	worktrees := gitadapter.New(gitadapter.Options{
		Layout:           layout,
		CredentialHelper: credentialHelper(),
		// A create takes a worktree checked out ahead of it and leaves
		// the next one behind (02-runner §5).
		Spares: true,
	})
	devices, err := hostDevices()
	if err != nil {
		return nil, err
	}
	app.Devices = devices
	sessions, err := sessionsapp.New(sessionsapp.Options{
		Terminals:  terminals,
		Worktrees:  worktrees,
		Classifier: manifest.New(manifest.Options{Dir: paths.Manifests()}),
		Store:      sessionstate.New(paths.State()),
		Files:      filestore.New(paths.Files()),
		Places:     places,
		Layout:     layout,
		Env: func(session sessionsdomain.Session) map[string]string {
			env := sessionEnv(paths, session)
			for key, value := range pinDevice(devices, session) {
				env[key] = value
			}
			return env
		},
		// A session never starts an agent CLI its updater is replacing.
		Gate: agentGate{paths: paths},
		// A session nobody is asked to approve starts in a folder already
		// trusted, rather than on a question in an empty terminal.
		Trust: agenttrust.New(agenttrust.Options{ClaudeConfig: claudeConfigPath(paths)}),
		// A session launched with no task is named from the first message
		// typed into its agent, read off the agent's own transcript.
		Transcripts: transcript.New(transcript.Options{
			ClaudeProjects: claudeProjectsPath(paths),
			StatusDir:      StatusDir(paths),
		}),
		// Claude Code hands its status line the context and the plan's usage,
		// which the chat shows; the runner's own takes them on the way.
		StatusLine: statusLineCommand(),
	})
	if err != nil {
		return nil, err
	}
	app.Sessions = sessions
	app.Worktrees = worktrees
	app.WorkFolder = places
	app.Terminals = terminals

	binStore, err := binaries.New(binaries.Options{
		Dir: paths.Bin(), Name: "runner", HTTP: &http.Client{Timeout: 10 * time.Minute},
	})
	if err != nil {
		return nil, err
	}
	app.Binaries = binStore

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

// sessionEnv is a session's tmux environment. A worktree session's git asks
// the runner's credential helper for the session's own token; a folder
// session's folder is the person's, so its git keeps the person's own
// credentials and is told nothing (24 §3).
func sessionEnv(paths Paths, session sessionsdomain.Session) map[string]string {
	env := map[string]string{
		"OPPENHEIMER_SESSION": session.ID,
		"OPPENHEIMER_SOCKET":  paths.Socket(),
	}
	if session.Place == sessionsdomain.PlaceFolder {
		return env
	}
	env["OPPENHEIMER_REPO"] = session.Repo
	for key, value := range shellCredentialHelper(paths) {
		env[key] = value
	}
	return env
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

// serviceManager picks the init system; an unsupported platform gets nil.
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
	// An install that opted out of agent updates stays opted out under the
	// service, which would not otherwise see the installer's environment.
	if updates := os.Getenv(EnvAgentUpdates); updates != "" {
		env[EnvAgentUpdates] = updates
	}
	// The devices and the Argent the installer was told about.
	for _, key := range []string{EnvDevices, EnvArgentSimulatorServer, EnvArgentToolsURL, EnvArgentToken, "ANDROID_HOME"} {
		if value := os.Getenv(key); value != "" {
			env[key] = value
		}
	}
	// The installer's PATH, carried onto the service: launchd hands a job
	// `/usr/bin:/bin:/usr/sbin:/sbin` and systemd little more, neither with
	// `/opt/homebrew/bin`, so on a stock Homebrew Mac the service could not
	// see the tmux, git and agent that `runner status`, run from the caller's
	// shell, reports present. The tools the installer verified are then the
	// tools the service can reach.
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

// WithInstallBins is path with every catalog installer's directory under
// home appended, each once. Appended, not prepended: a CLI the person
// installed their own way, earlier on PATH, keeps winning over one the runner
// put in `~/.local/bin`.
func WithInstallBins(path, home string) string {
	entries := filepath.SplitList(path)
	for _, bin := range hostdomain.InstallBins() {
		dir := filepath.Join(home, bin)
		if !slices.Contains(entries, dir) {
			entries = append(entries, dir)
		}
	}
	return strings.Join(entries, string(os.PathListSeparator))
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

// shellCredentialHelper is git configuration, as environment, that points
// the git in a session's shell at the runner's helper for GitHub (02-runner
// §8). The store is blobless, so a `git log -p` or `blame` there fetches
// contents the checkout never needed, and needs the session's token as much
// as a push does. Configuration from the environment is read after every
// file, so a helper the person set up is still asked first.
//
// The helper is the service's `current` link, not this binary: a session
// outlives an update, and the version it was created under may be gone.
func shellCredentialHelper(paths Paths) map[string]string {
	helper := credentialHelper()
	if _, err := os.Stat(paths.Current()); err == nil {
		helper = paths.Current() + " credential-helper"
	}
	if helper == "" {
		return nil
	}
	return map[string]string{
		"GIT_CONFIG_COUNT":   "1",
		"GIT_CONFIG_KEY_0":   "credential.https://github.com.helper",
		"GIT_CONFIG_VALUE_0": helper,
	}
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

// RequiredTools re-exports the host context's list, so the CLI does not reach
// into another context's domain for a constant.
var RequiredTools = hostdomain.RequiredTools

// claudeConfigPath is where Claude Code keeps its global state: in
// `$CLAUDE_CONFIG_DIR` when that is set, the account's home otherwise. The
// agent runs in a tmux server started by this process, so it sees the same
// variable.
func claudeConfigPath(paths Paths) string {
	if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
		return filepath.Join(dir, ".claude.json")
	}
	if paths.UserHome == "" {
		return ""
	}
	return filepath.Join(paths.UserHome, ".claude.json")
}

// claudeProjectsPath is where Claude Code keeps its transcripts, one folder
// per working directory: `projects/` under `$CLAUDE_CONFIG_DIR` when that is
// set, under `~/.claude` otherwise. Unlike its global state, which sits
// beside that folder in the home, the transcripts are inside it.
func claudeProjectsPath(paths Paths) string {
	if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
		return filepath.Join(dir, "projects")
	}
	if paths.UserHome == "" {
		return ""
	}
	return filepath.Join(paths.UserHome, ".claude", "projects")
}

package domain

import (
	"errors"
	"slices"
	"strings"
	"time"
)

// ToolInstallTimeout bounds one install: a vendor installer downloading a
// release, or npm resolving a package, on a slow link. One that hangs past it
// is killed with its process group and reported as failed.
const ToolInstallTimeout = 10 * time.Minute

// toolInstall is one catalog `install` entry: a sh script per platform family
// and the home-relative directory it leaves the executable in. The table is
// generated into host_tools.gen.go.
type toolInstall struct {
	kind  string
	macos string
	linux string
	bin   string
}

// installMethod names how a CLI was installed by a fragment of its resolved
// path.
type installMethod struct {
	method       string
	pathContains string
}

// packageNames is the package that provides a host tool, per package manager.
type packageNames struct {
	brew string
	apt  string
}

// InstallKind says what a catalog install is for: an agent CLI
// (`runner agents install`) or a host tool (`runner tools install`).
type InstallKind string

const (
	InstallAgent InstallKind = "agent"
	InstallTool  InstallKind = "tool"
)

// Sentinel conditions of an install. The use case maps them onto the catalog.
var (
	// ErrInstallUnknown: nothing in the catalogs installs this name.
	ErrInstallUnknown = errors.New("not a tool the runner knows how to install")
	// ErrInstallByPackageManager: the tool is the package manager's (git,
	// tmux) and installing it needs root, which the runner never takes.
	ErrInstallByPackageManager = errors.New("installed with the package manager")
	// ErrInstallPlatform: the catalog has no installer for this platform.
	ErrInstallPlatform = errors.New("no installer for this platform")
)

// InstallName is the executable an install is keyed by, for a name the
// person or the console may use: a catalog id (`claude-code`) or the
// executable itself (`claude`). An unknown name comes back as it was.
func InstallName(name string) string {
	if executable, ok := installAliases[name]; ok {
		return executable
	}
	return name
}

// InstallKindOf is what kind of tool the runner installs under name — an
// agent CLI or a host tool — whatever the platform. ok is false for a name
// the runner does not install, git and tmux included.
func InstallKindOf(name string) (InstallKind, bool) {
	entry, ok := toolInstalls[name]
	return InstallKind(entry.kind), ok
}

// InstallScript is the script that installs tool on platform. A tool the
// package manager owns answers ErrInstallByPackageManager, so the caller can
// show PackageInstallCommand instead of a refusal with nothing to do.
func InstallScript(tool string, platform Platform) (string, error) {
	entry, ok := toolInstalls[tool]
	if !ok {
		if _, packaged := packageInstalls[tool]; packaged {
			return "", ErrInstallByPackageManager
		}
		return "", ErrInstallUnknown
	}
	var script string
	switch platform {
	case PlatformMacOS:
		script = entry.macos
	case PlatformDebian, PlatformUbuntu:
		script = entry.linux
	case PlatformLinuxOther, PlatformUnsupported:
	}
	if script == "" {
		return "", ErrInstallPlatform
	}
	return script, nil
}

// Installable lists the names InstallScript knows of the given kind, in a
// stable order for a usage line.
func Installable(kind InstallKind) []string {
	var names []string
	for name, entry := range toolInstalls {
		if InstallKind(entry.kind) == kind {
			names = append(names, name)
		}
	}
	slices.Sort(names)
	return names
}

// InstallUsage is the one line that says what can be installed and with
// which command, for a refusal or a usage message.
func InstallUsage() string {
	return "runner agents install " + strings.Join(Installable(InstallAgent), "|") +
		", or runner tools install " + strings.Join(Installable(InstallTool), "|")
}

// InstallBins is every directory, relative to the home, a catalog installer
// leaves an executable in. The runner puts them on its own PATH so a tool it
// installed is found without a shell profile the service never reads.
//
// Every entry is home-relative: the catalog writes them `~/…` and the
// generator refuses anything else, so a caller joins them to the home and
// never has to tell a relative path from an absolute one.
func InstallBins() []string {
	var bins []string
	for _, entry := range toolInstalls {
		if !slices.Contains(bins, entry.bin) {
			bins = append(bins, entry.bin)
		}
	}
	slices.Sort(bins)
	return bins
}

// PackageInstallCommand is the exact command that installs the named host
// tools with this platform's package manager, for a person to run: the runner
// never runs it, because it needs root. Empty when the platform has no
// package manager the MVP knows.
func PackageInstallCommand(platform Platform, tools []string) string {
	var packages []string
	for _, tool := range tools {
		names, ok := packageInstalls[tool]
		if !ok {
			names = packageNames{brew: tool, apt: tool}
		}
		switch platform {
		case PlatformMacOS:
			packages = append(packages, names.brew)
		case PlatformDebian, PlatformUbuntu:
			packages = append(packages, names.apt)
		case PlatformLinuxOther, PlatformUnsupported:
		}
	}
	if len(packages) == 0 {
		return ""
	}
	switch platform {
	case PlatformMacOS:
		return "brew install " + strings.Join(packages, " ")
	case PlatformDebian, PlatformUbuntu:
		return "sudo apt-get install -y " + strings.Join(packages, " ")
	case PlatformLinuxOther, PlatformUnsupported:
	}
	return ""
}

// ResolveUpdateArgs is AgentUpdateArgs with `<method>` filled in from where
// the executable really lives (resolved, with symlinks followed). ok is false
// when the tool has no updater, or its updater needs a method and none of the
// catalog's matches the path: an install the runner cannot name is one whose
// replacement is not its to do.
func ResolveUpdateArgs(tool, resolved string) (args []string, ok bool) {
	args, ok = AgentUpdateArgs(tool)
	if !ok || !slices.Contains(args, "<method>") {
		return args, ok
	}
	method := ""
	for _, m := range updateMethods[tool] {
		if strings.Contains(resolved, m.pathContains) {
			method = m.method
			break
		}
	}
	if method == "" {
		return nil, false
	}
	for i, arg := range args {
		if arg == "<method>" {
			args[i] = method
		}
	}
	return args, true
}

// InstallOutcome is what one install came to.
type InstallOutcome string

const (
	// InstallInstalled: the tool was missing and is now on PATH.
	InstallInstalled InstallOutcome = "installed"
	// InstallPresent: the tool was already there; nothing ran.
	InstallPresent InstallOutcome = "present"
)

// InstallResult is one install's answer: the tool as the probe now sees it.
type InstallResult struct {
	Tool    string         `json:"tool"`
	Kind    InstallKind    `json:"kind"`
	Outcome InstallOutcome `json:"outcome"`
	Path    string         `json:"path,omitempty"`
	Version string         `json:"version,omitempty"`
}

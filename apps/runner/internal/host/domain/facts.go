// Package domain holds what the runner knows about the machine it was
// installed on: which platform it is, which tools a session needs and whether
// they are there, and the conditions that make the host unusable.
package domain

import (
	"errors"
	"fmt"
	"strings"
)

// Platform is the host family, at the granularity the installer and the
// service manager care about. macOS gets launchd and Homebrew; Debian and
// Ubuntu get a systemd user unit and apt. Anything else is unsupported in the
// MVP — recognised, named, and refused with the list of what is supported.
type Platform string

const (
	PlatformMacOS       Platform = "macos"
	PlatformDebian      Platform = "debian"
	PlatformUbuntu      Platform = "ubuntu"
	PlatformLinuxOther  Platform = "linux"
	PlatformUnsupported Platform = "unsupported"
)

// Supported reports whether the MVP runs here.
func (p Platform) Supported() bool {
	switch p {
	case PlatformMacOS, PlatformDebian, PlatformUbuntu:
		return true
	case PlatformLinuxOther, PlatformUnsupported:
		return false
	}
	return false
}

// PackageManager is the command that installs a missing dependency, or "" when
// the user has to do it themselves.
func (p Platform) PackageManager() string {
	switch p {
	case PlatformMacOS:
		return "brew"
	case PlatformDebian, PlatformUbuntu:
		return "apt-get"
	case PlatformLinuxOther, PlatformUnsupported:
		return ""
	}
	return ""
}

// ServiceKind is the init system a runner registers with here.
func (p Platform) ServiceKind() string {
	switch p {
	case PlatformMacOS:
		return "launchd"
	case PlatformDebian, PlatformUbuntu, PlatformLinuxOther:
		return "systemd"
	case PlatformUnsupported:
		return ""
	}
	return ""
}

// SupportedPlatforms is what the MVP claims, for error messages that tell the
// user what to do instead of only what failed.
func SupportedPlatforms() string {
	return "macOS, Debian and Ubuntu"
}

// Tool is one executable a session depends on.
type Tool struct {
	Name     string `json:"name"`
	Path     string `json:"path,omitempty"`
	Version  string `json:"version,omitempty"`
	Required bool   `json:"required"`
}

// Found reports whether the tool is on PATH.
func (t Tool) Found() bool { return t.Path != "" }

// Tool names the runner probes. `git` and `tmux` are how a session exists at
// all; `claude` is the agent, and a host without it still pairs and still
// opens a terminal — the install hint belongs in the UI, not in a refusal.
const (
	ToolGit    = "git"
	ToolTmux   = "tmux"
	ToolClaude = "claude"
)

// RequiredTools are the ones whose absence stops sessions.
var RequiredTools = []string{ToolGit, ToolTmux}

// DiskFloor is the free space below which the runner stops opening sessions:
// a worktree plus a node_modules plus a build, rounded up to something a
// human recognises.
const DiskFloor = 2 << 30 // 2 GiB

// Facts is the inventory: collected at registration, refreshed on demand, and
// summarised in every heartbeat.
type Facts struct {
	Platform      Platform `json:"platform"`
	OSVersion     string   `json:"osVersion,omitempty"`
	Arch          string   `json:"arch"`
	Hostname      string   `json:"hostname"`
	User          string   `json:"user"`
	Home          string   `json:"home"`
	Root          bool     `json:"root"`
	Tools         []Tool   `json:"tools"`
	WorkspacePath string   `json:"workspacePath"`
	DiskFreeBytes uint64   `json:"diskFreeBytes"`
	RunnerVersion string   `json:"runnerVersion"`
}

// Sentinel conditions. The use case maps these onto the problem catalog; the
// domain stays free of HTTP.
var (
	ErrUnsupportedPlatform = errors.New("platform is not supported")
	ErrRunningAsRoot       = errors.New("runner is running as root")
	ErrToolMissing         = errors.New("a required tool is missing")
	ErrDiskLow             = errors.New("free disk is below the floor")
)

// Tool returns a probed tool by name.
func (f Facts) Tool(name string) (Tool, bool) {
	for _, t := range f.Tools {
		if t.Name == name {
			return t, true
		}
	}
	return Tool{}, false
}

// MissingRequired lists the required tools that were not found.
func (f Facts) MissingRequired() []string {
	var missing []string
	for _, t := range f.Tools {
		if t.Required && !t.Found() {
			missing = append(missing, t.Name)
		}
	}
	return missing
}

// Validate reports the first condition that makes this host unusable, in the
// order the user should fix them. Running as root comes first: it is the one
// mistake that is easier to undo before anything else has been written.
func (f Facts) Validate() error {
	if f.Root {
		return ErrRunningAsRoot
	}
	if !f.Platform.Supported() {
		return fmt.Errorf("%w: %s", ErrUnsupportedPlatform, f.Platform)
	}
	if missing := f.MissingRequired(); len(missing) > 0 {
		return fmt.Errorf("%w: %s", ErrToolMissing, strings.Join(missing, ", "))
	}
	if f.DiskFreeBytes > 0 && f.DiskFreeBytes < DiskFloor {
		return fmt.Errorf("%w: %s free", ErrDiskLow, HumanBytes(f.DiskFreeBytes))
	}
	return nil
}

// HumanBytes renders a byte count the way a status line should.
func HumanBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit && exp < 3; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(b)/float64(div), "KMGT"[exp])
}

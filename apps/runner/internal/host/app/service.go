package app

import (
	"context"
	"errors"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// Options configure the inventory service.
type Options struct {
	Prober Prober
	// WorkspaceRoot is the directory sessions' worktrees live under; its
	// filesystem is the one whose free space matters.
	WorkspaceRoot string
	// Version is the running runner's version, reported with the facts.
	Version string
}

// Service collects the host inventory.
type Service struct {
	prober    Prober
	workspace string
	version   string
}

// New builds the service.
func New(opts Options) *Service {
	return &Service{prober: opts.Prober, workspace: opts.WorkspaceRoot, version: opts.Version}
}

// Collect inspects the machine. It answers with whatever it could learn even
// when something is missing, because "tmux is not installed" is a fact to
// report, not an error to swallow the rest of the inventory for.
func (s *Service) Collect(ctx context.Context) (domain.Facts, error) {
	platform, osVersion, err := s.prober.Platform(ctx)
	if err != nil {
		return domain.Facts{}, domain.ErrProbe.WithDetail("read the platform: %v", err).WithCause(err)
	}
	user, home, hostname, root := s.prober.Identity()

	facts := domain.Facts{
		Platform:      platform,
		OSVersion:     osVersion,
		Arch:          arch(),
		Hostname:      hostname,
		User:          user,
		Home:          home,
		Root:          root,
		WorkspacePath: s.workspace,
		RunnerVersion: s.version,
	}
	for _, name := range domain.ProbedTools {
		tool := s.prober.Tool(ctx, name)
		tool.Name = name
		tool.Required = required(name)
		facts.Tools = append(facts.Tools, tool)
	}
	if s.workspace != "" {
		if free, err := s.prober.DiskFree(filepath.Clean(s.workspace)); err == nil {
			facts.DiskFreeBytes = free
		}
	}
	return facts, nil
}

// Preflight collects the facts and reports the first blocking condition as a
// problem, so the CLI, the installer and the control plane all describe a
// broken host the same way.
func (s *Service) Preflight(ctx context.Context) (domain.Facts, error) {
	facts, err := s.Collect(ctx)
	if err != nil {
		return facts, err
	}
	switch err := facts.Validate(); {
	case err == nil:
		return facts, nil
	case errors.Is(err, domain.ErrRunningAsRoot):
		return facts, domain.ErrRoot.WithDetail(
			"the runner owns your sessions and must run as your own account, not root").WithCause(err)
	case errors.Is(err, domain.ErrUnsupportedPlatform):
		return facts, domain.ErrPlatformUnsupported.WithDetail(
			"this host is %s; the runner supports %s", facts.Platform, domain.SupportedPlatforms()).WithCause(err)
	case errors.Is(err, domain.ErrToolMissing):
		return facts, domain.ErrPreflight.WithDetail("%v; install it with %s", err, installHint(facts)).WithCause(err)
	case errors.Is(err, domain.ErrDiskLow):
		return facts, domain.ErrDiskPressure.WithDetail(
			"%v on %s, the floor is %s", err, facts.WorkspacePath, domain.HumanBytes(domain.DiskFloor)).WithCause(err)
	default:
		return facts, domain.ErrProbe.WithCause(err)
	}
}

func required(name string) bool {
	for _, r := range domain.RequiredTools {
		if r == name {
			return true
		}
	}
	return false
}

// installHint names the command that fixes a missing tool on this platform.
func installHint(facts domain.Facts) string {
	missing := facts.MissingRequired()
	switch facts.Platform {
	case domain.PlatformMacOS:
		return "brew install " + join(missing)
	case domain.PlatformDebian, domain.PlatformUbuntu:
		return "sudo apt-get install -y " + join(missing)
	case domain.PlatformLinuxOther, domain.PlatformUnsupported:
		return "your package manager"
	}
	return "your package manager"
}

func join(names []string) string {
	out := ""
	for i, n := range names {
		if i > 0 {
			out += " "
		}
		out += n
	}
	return out
}

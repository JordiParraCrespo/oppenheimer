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
	// Updater runs the agents' own updaters. Nil disables UpdateAgents.
	Updater Updater
}

// Service collects the host inventory.
type Service struct {
	prober    Prober
	updater   Updater
	workspace string
	version   string
}

// New builds the service.
func New(opts Options) *Service {
	return &Service{prober: opts.Prober, updater: opts.Updater, workspace: opts.WorkspaceRoot, version: opts.Version}
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
		CPUs:          cpus(),
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
		if total, err := s.prober.DiskTotal(filepath.Clean(s.workspace)); err == nil {
			facts.DiskTotalBytes = total
		}
	}
	facts.Machine = s.prober.Machine(ctx)
	facts.ServiceManager = platform.ServiceKind()
	return facts, nil
}

// Preflight collects the facts afresh, bypassing anything the prober cached,
// and reports the first blocking condition as a problem, so the CLI, the
// installer and the control plane all describe a broken host the same way.
func (s *Service) Preflight(ctx context.Context) (domain.Facts, error) {
	s.prober.Invalidate()
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

// UpdateAgents runs the updater of every agent CLI found on PATH, one after
// another, and reports what each came to. An agent that is not installed is
// skipped: installing one is the person's choice, keeping it current is ours
// (`product/versions/mvp/02-runner.md` §"Agent updates").
//
// Sessions already running keep the binary they started with; the next
// session starts the new one. The facts' tool versions are read again after,
// so the next heartbeat carries them and the control plane records the change
// on the host's timeline.
func (s *Service) UpdateAgents(ctx context.Context) []domain.AgentUpdate {
	if s.updater == nil {
		return nil
	}
	var results []domain.AgentUpdate
	for _, name := range domain.ProbedTools {
		args, ok := domain.AgentUpdateArgs(name)
		if !ok {
			continue
		}
		before := s.prober.Tool(ctx, name)
		if !before.Found() {
			continue
		}
		output, err := s.updater.Update(ctx, before.Path, args)
		if ctx.Err() != nil {
			// Shutting down: an updater cut short is not a failure to report.
			return results
		}
		// The prober keys its cache on the file, which an in-place update
		// rewrites; forgetting it is the backstop for one that does not.
		s.prober.Invalidate()
		after := s.prober.Tool(ctx, name)
		result := domain.AgentUpdate{Tool: name, From: before.Version, To: after.Version}
		switch {
		case err != nil:
			result.Outcome = domain.AgentUpdateFailed
			result.Detail = domain.UpdateFailureDetail(output)
			if result.Detail == "" {
				result.Detail = err.Error()
			}
		case !domain.SameVersion(before.Version, after.Version):
			result.Outcome = domain.AgentUpdated
		default:
			result.Outcome = domain.AgentCurrent
		}
		results = append(results, result)
	}
	return results
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

package app

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

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
	// Installer runs the catalogs' install scripts. Nil disables Install.
	Installer Installer
}

// Service collects the host inventory.
type Service struct {
	prober    Prober
	updater   Updater
	installer Installer
	workspace string
	version   string
}

// New builds the service.
func New(opts Options) *Service {
	return &Service{
		prober: opts.Prober, updater: opts.Updater, installer: opts.Installer,
		workspace: opts.WorkspaceRoot, version: opts.Version,
	}
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

// UpdateAgents runs the unattended updater of every agent CLI found on PATH,
// one after another, and reports what each came to. An agent that is not
// installed is skipped: installing one is the person's choice, keeping it
// current is ours (`product/versions/mvp/02-runner.md` §10).
//
// Sessions already running keep the binary they started with; the next
// session starts the new one. The versions are read afresh once the round is
// over, so the next heartbeat carries them.
func (s *Service) UpdateAgents(ctx context.Context) []domain.AgentUpdate {
	if s.updater == nil {
		return nil
	}
	type ran struct {
		name   string
		before domain.Tool
		err    error
	}
	var round []ran
	for _, name := range domain.ProbedTools {
		if _, ok := domain.AgentUpdateArgs(name); !ok {
			continue
		}
		before := s.prober.Tool(ctx, name)
		if !before.Found() {
			continue
		}
		// An updater that needs the install method runs only when the path
		// names one; otherwise it would stop to ask, so it is skipped.
		args, ok := domain.ResolveUpdateArgs(name, before.Resolved)
		if !ok {
			continue
		}
		err := s.updater.Update(ctx, name, before.Path, args)
		if ctx.Err() != nil {
			// Shutting down: an updater cut short is not a failure to report.
			return nil
		}
		round = append(round, ran{name: name, before: before, err: err})
	}
	if len(round) == 0 {
		return nil
	}
	// The prober keys its cache on the file, which an in-place update
	// rewrites; one drop for the round is the backstop for one that does not.
	s.prober.Invalidate()
	results := make([]domain.AgentUpdate, 0, len(round))
	for _, r := range round {
		after := s.prober.Tool(ctx, r.name)
		result := domain.AgentUpdate{Tool: r.name, From: r.before.Version, To: after.Version}
		switch {
		case r.err != nil:
			result.Outcome = domain.AgentUpdateFailed
			result.Detail = r.err.Error()
		case !domain.SameVersion(r.before.Version, after.Version):
			result.Outcome = domain.AgentUpdated
		default:
			result.Outcome = domain.AgentCurrent
		}
		results = append(results, result)
	}
	return results
}

// Install puts one catalog tool on this host, user-level and unattended: an
// agent CLI (`runner agents install claude`) or a host tool (`runner tools
// install gh`). It is the person's choice, so it runs only when asked, and it
// is idempotent: a tool already on PATH is reported, not reinstalled.
//
// git and tmux are refused with the package manager's exact command, because
// installing them needs root and the runner never takes it.
func (s *Service) Install(ctx context.Context, name string) (domain.InstallResult, error) {
	platform, _, err := s.prober.Platform(ctx)
	if err != nil {
		return domain.InstallResult{}, domain.ErrProbe.WithDetail("read the platform: %v", err).WithCause(err)
	}
	script, kind, err := domain.InstallScript(name, platform)
	switch {
	case errors.Is(err, domain.ErrInstallByPackageManager):
		command := domain.PackageInstallCommand(platform, []string{name})
		if command == "" {
			command = "your package manager"
		}
		return domain.InstallResult{}, domain.ErrInstallUnsupported.WithDetail(
			"%s comes from the package manager and needs root; run: %s", name, command).WithCause(err)
	case errors.Is(err, domain.ErrInstallPlatform):
		return domain.InstallResult{}, domain.ErrInstallUnsupported.WithDetail(
			"there is no installer for %s on %s", name, platform).WithCause(err)
	case err != nil:
		return domain.InstallResult{}, domain.ErrInstallUnsupported.WithDetail(
			"%q is not one of %s", name, strings.Join(append(domain.Installable(domain.InstallAgent),
				domain.Installable(domain.InstallTool)...), ", ")).WithCause(err)
	}
	result := domain.InstallResult{Tool: name, Kind: kind}

	s.prober.Invalidate()
	if before := s.prober.Tool(ctx, name); before.Found() {
		result.Outcome, result.Path, result.Version = domain.InstallPresent, before.Path, before.Version
		return result, nil
	}
	if s.installer == nil {
		return result, domain.ErrInstallFailed.WithDetail("this runner was built without an installer")
	}
	if err := s.installer.Install(ctx, name, script); err != nil {
		return result, domain.ErrInstallFailed.WithDetail("%s: %v", name, err).WithCause(err)
	}
	s.prober.Invalidate()
	after := s.prober.Tool(ctx, name)
	if !after.Found() {
		// The script succeeded and left nothing the runner can find: the
		// vendor moved its destination, or the PATH lacks the catalog bin.
		return result, domain.ErrInstallFailed.WithDetail(
			"the installer for %s finished, but %s is still not on PATH", name, name)
	}
	result.Outcome, result.Path, result.Version = domain.InstallInstalled, after.Path, after.Version
	return result, nil
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
	if command := domain.PackageInstallCommand(facts.Platform, facts.MissingRequired()); command != "" {
		return command
	}
	return "your package manager"
}

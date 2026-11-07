package app

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ExecPolicy is what the host lets bots run, as it is enforced.
func (s *Service) ExecPolicy() (domain.ExecPolicy, error) {
	if s.policies == nil {
		return domain.ExecPolicy{Mode: domain.ExecOff}, nil
	}
	policy, err := s.policies.Load()
	if err != nil {
		return domain.ExecPolicy{}, domain.ErrExecPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return policy.Normalized(), nil
}

// SetExecPolicy saves what the host lets bots run, for `runner exec`.
func (s *Service) SetExecPolicy(policy domain.ExecPolicy) error {
	if s.policies == nil {
		return domain.ErrExecPolicyFile.WithDetail("this runner keeps no exec policy")
	}
	if err := s.policies.Save(policy.Normalized()); err != nil {
		return domain.ErrExecPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

// Exec runs one program for a bot (`host.exec`, 25 §4.2). The policy is read
// from disk on every call, so a `runner exec` change applies to the next
// command without a restart, and it is checked before anything is created or
// run. The run starts in req.Dir, which must be a directory already there, or
// in the bot's own folder under the workspaces, made on first use and kept.
func (s *Service) Exec(ctx context.Context, req domain.ExecRequest) (domain.ExecResult, error) {
	if s.executor == nil {
		return domain.ExecResult{}, domain.ErrExecDisabled.WithDetail("this runner runs no commands")
	}
	policy, err := s.ExecPolicy()
	if err != nil {
		return domain.ExecResult{}, err
	}
	if len(req.Argv) == 0 {
		return domain.ExecResult{}, domain.ErrExecStart.WithDetail("no program named")
	}

	dir, own := req.Dir, req.Dir == ""
	if own {
		if s.workspace == "" {
			return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("this runner has no workspaces folder")
		}
		dir = filepath.Join(s.workspace, domain.BotsDir, req.Home)
	}
	if !filepath.IsAbs(dir) {
		return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("%q is not an absolute path", dir)
	}
	dir = filepath.Clean(dir)

	// A program named by a path is checked, and run, as the file it really
	// is: the policy matches text, the kernel follows symlinks and `..`, and
	// the two must agree on which program runs.
	if strings.Contains(req.Argv[0], "/") {
		path := req.Argv[0]
		if !filepath.IsAbs(path) {
			path = filepath.Join(dir, path)
		}
		real, err := filepath.EvalSymlinks(path)
		if err != nil {
			return domain.ExecResult{}, domain.ErrExecStart.WithDetail("%s: %v", req.Argv[0], err).WithCause(err)
		}
		req.Argv = append([]string{real}, req.Argv[1:]...)
	}

	switch err := policy.Permits(req.Argv[0], dir); {
	case errors.Is(err, domain.ErrExecOff):
		return domain.ExecResult{}, domain.ErrExecDisabled.WithDetail(
			"the person on this host can allow it with `runner exec mode allowlist` and `runner exec allow <program>`").WithCause(err)
	case errors.Is(err, domain.ErrExecNotAllowed):
		return domain.ExecResult{}, domain.ErrExecRefused.WithDetail(
			"%s is not on this host's allowlist; the person on this host can add it with `runner exec allow`", req.Argv[0]).WithCause(err)
	case err != nil:
		return domain.ExecResult{}, domain.ErrExecRefused.WithCause(err)
	}

	if own {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("make %s: %v", dir, err).WithCause(err)
		}
	}
	switch info, err := os.Stat(dir); {
	case errors.Is(err, fs.ErrNotExist):
		return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("%s does not exist", dir).WithCause(err)
	case err != nil:
		return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("%s cannot be read: %v", dir, err).WithCause(err)
	case !info.IsDir():
		return domain.ExecResult{}, domain.ErrExecFolder.WithDetail("%s is not a directory", dir)
	}

	select {
	case s.execSlots <- struct{}{}:
		defer func() { <-s.execSlots }()
	default:
		return domain.ExecResult{}, domain.ErrExecStart.WithDetail(
			"%d commands are already running on this host; try again when one ends", cap(s.execSlots))
	}

	req.Dir = dir
	result, err := s.executor.Run(ctx, req)
	if err != nil {
		return domain.ExecResult{}, domain.ErrExecStart.WithDetail("%s: %v", req.Argv[0], err).WithCause(err)
	}
	result.Dir = dir
	return result, nil
}

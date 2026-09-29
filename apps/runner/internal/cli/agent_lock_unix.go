//go:build darwin || linux

package cli

import (
	"context"
	"os"
	"path/filepath"
	"syscall"
	"time"

	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// AgentLock is the lock file of one agent CLI: held exclusively while its
// updater runs, shared while a session starts it. A file lock rather than a
// mutex because the two may be in different processes — the daemon's round
// and a `runner agents update` typed on the host.
func (p Paths) AgentLock(tool string) string {
	return filepath.Join(p.Run(), "agent-"+tool+".lock")
}

// agentLockPoll is how often a wait for an agent's lock tries again.
const agentLockPoll = 100 * time.Millisecond

// launchWaitLimit bounds how long a session waits on its agent's update: past
// one updater's own timeout, the lock is held by something stuck, and a
// launch late is better than none.
const launchWaitLimit = hostdomain.AgentUpdateTimeout + 30*time.Second

// lockAgent takes an agent's lock, waiting for it until ctx ends. how is
// syscall.LOCK_EX or syscall.LOCK_SH.
func lockAgent(ctx context.Context, path string, how int) (release func(), err error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // the runner's own lock file, under a 0700 directory it owns
	if err != nil {
		return nil, err
	}
	for {
		if err := syscall.Flock(int(f.Fd()), how|syscall.LOCK_NB); err == nil {
			return func() {
				_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
				_ = f.Close()
			}, nil
		}
		select {
		case <-ctx.Done():
			_ = f.Close()
			return nil, ctx.Err()
		case <-time.After(agentLockPoll):
		}
	}
}

// lockedUpdater runs an updater under its agent's exclusive lock, so two
// rounds never run one CLI's updater at once and no session starts it midway.
type lockedUpdater struct {
	paths Paths
	next  hostapp.Updater
}

var _ hostapp.Updater = lockedUpdater{}

func (u lockedUpdater) Update(ctx context.Context, tool, path string, args []string) error {
	release, err := lockAgent(ctx, u.paths.AgentLock(tool), syscall.LOCK_EX)
	if err != nil {
		return err
	}
	defer release()
	return u.next.Update(ctx, tool, path, args)
}

// agentGate is the sessions' LaunchGate on the same locks.
type agentGate struct{ paths Paths }

var _ sessionsapp.LaunchGate = agentGate{}

func (g agentGate) Hold(ctx context.Context, command string) func() {
	ctx, cancel := context.WithTimeout(ctx, launchWaitLimit)
	defer cancel()
	release, err := lockAgent(ctx, g.paths.AgentLock(command), syscall.LOCK_SH)
	if err != nil {
		// Waited out, or the lock file could not be opened: launch anyway.
		return func() {}
	}
	return release
}

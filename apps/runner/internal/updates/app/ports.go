// Package app is the update use case: check, apply, gate, roll back. Every
// step that touches the network or the filesystem is a port, so the whole
// sequence — including the rollback — is exercised in tests without a release
// server, a signing key or a service manager.
package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

// Releases answers what this host is offered. The implementation verifies the
// manifest's signature before this returns; an unverified manifest never
// becomes a domain.Release.
type Releases interface {
	Fetch(ctx context.Context, channel string) (domain.Release, error)
}

// Binaries is the versioned directory the service unit's `current` symlink
// points into.
type Binaries interface {
	// Stage downloads and verifies an artifact and returns the path of the
	// unpacked, not-yet-activated binary.
	Stage(ctx context.Context, artifact domain.Artifact, version string) (string, error)
	// SelfCheck runs the staged binary's own `selfcheck` subcommand. A
	// wrong-arch, truncated or incompatible binary fails here, while the
	// old one is still the service.
	SelfCheck(ctx context.Context, path string) error
	// Promote moves a staged binary in as a version, without activating it.
	Promote(stagedPath, version string) error
	// Activate points `current` at an installed version.
	Activate(version string) error
	// Current is the version `current` points at.
	Current() (string, error)
	// Prune deletes every version except the ones named.
	Prune(keep ...string) error
}

// Restarter restarts the runner's service unit; the composition root satisfies
// it with the service context.
type Restarter interface {
	Restart(ctx context.Context) error
}

// StateStore persists update.json across the restart the update causes. It is
// the only memory the update has: the process that starts it is not the
// process that finishes it.
type StateStore interface {
	Load() (domain.State, error)
	Save(domain.State) error
}

// Activities reports what the host is doing, for the safe window.
type Activities interface {
	Snapshot() domain.Activity
}

// IdleActivity is the default until the sessions context exists: a host with
// no sessions is quiet, which is the truth on an MVP runner.
type IdleActivity struct{}

// Snapshot implements Activities.
func (IdleActivity) Snapshot() domain.Activity { return domain.Activity{} }

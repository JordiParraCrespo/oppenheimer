// Package app installs, removes, restarts and reports the runner's service
// unit. The init system is a port, so the use case is the same sentence on
// both platforms and neither adapter has policy in it.
package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
)

// Manager is one init system.
type Manager interface {
	Kind() domain.Kind
	// Install writes the unit, loads it and starts it. It is idempotent: on
	// a host that already runs the service it replaces the unit and
	// restarts, which is what re-running the installer must do.
	Install(ctx context.Context, unit domain.Unit) error
	Uninstall(ctx context.Context) error
	Restart(ctx context.Context) error
	Status(ctx context.Context) (domain.Status, error)
	// Path is the unit file's location, for `runner status` and for the
	// uninstall summary.
	Path() string
}

// Commands runs a program and returns its combined output. Adapters take it
// so a test can assert the exact `launchctl` and `systemctl` invocations
// without a launchd or a systemd.
type Commands interface {
	Run(ctx context.Context, name string, args ...string) (string, error)
}

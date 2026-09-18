package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
)

// Options configure the service-management use cases.
type Options struct {
	Manager Manager
	// Unit is the unit this host would install: built once by the
	// composition root, which is the only place that knows the paths.
	Unit domain.Unit
}

// Service manages the runner's own service unit.
type Service struct {
	manager Manager
	unit    domain.Unit
}

// New builds the service. A nil manager is a platform with no service
// manager, which every use case reports as SVC_001 rather than panicking.
func New(opts Options) *Service { return &Service{manager: opts.Manager, unit: opts.Unit} }

// Install writes and starts the unit.
func (s *Service) Install(ctx context.Context) (domain.Status, error) {
	if s.manager == nil {
		return domain.Status{}, noManager()
	}
	if err := s.unit.Validate(); err != nil {
		return domain.Status{}, domain.ErrInstallFailed.WithDetail("%v", err).WithCause(err)
	}
	if err := s.manager.Install(ctx, s.unit); err != nil {
		return domain.Status{}, err
	}
	return s.manager.Status(ctx)
}

// Uninstall stops the service and removes the unit file.
func (s *Service) Uninstall(ctx context.Context) error {
	if s.manager == nil {
		return noManager()
	}
	return s.manager.Uninstall(ctx)
}

// Restart is what an update calls once the new binary is linked.
func (s *Service) Restart(ctx context.Context) error {
	if s.manager == nil {
		return noManager()
	}
	return s.manager.Restart(ctx)
}

// Status reports what the init system says.
func (s *Service) Status(ctx context.Context) (domain.Status, error) {
	if s.manager == nil {
		return domain.Status{}, noManager()
	}
	return s.manager.Status(ctx)
}

// Unit exposes the rendered unit, so `runner install --print` can show a user
// exactly what would be written before anything is.
func (s *Service) Unit() (domain.Unit, domain.Kind) {
	if s.manager == nil {
		return s.unit, ""
	}
	return s.unit, s.manager.Kind()
}

func noManager() error {
	return domain.ErrNoManager.WithDetail(
		"the runner installs a launchd agent on macOS and a systemd user unit on Debian and Ubuntu")
}

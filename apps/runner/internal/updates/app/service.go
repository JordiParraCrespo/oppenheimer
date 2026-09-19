package app

import (
	"context"
	"errors"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

// Options configure the update service.
type Options struct {
	Releases   Releases
	Binaries   Binaries
	Restarter  Restarter
	State      StateStore
	Activities Activities
	// Version is the running binary's version.
	Version string
	// Channel and Pinned come from the host's identity; the composition
	// root reads them, so this context never touches pairing's files.
	Channel string
	Pinned  string
	Now     func() time.Time
}

// Service is the update use cases.
type Service struct {
	releases   Releases
	binaries   Binaries
	restarter  Restarter
	state      StateStore
	activities Activities
	version    string
	channel    string
	pinned     string
	now        func() time.Time
}

// New builds the service.
func New(opts Options) *Service {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	activities := opts.Activities
	if activities == nil {
		activities = IdleActivity{}
	}
	return &Service{
		releases: opts.Releases, binaries: opts.Binaries, restarter: opts.Restarter,
		state: opts.State, activities: activities,
		version: opts.Version, channel: opts.Channel, pinned: opts.Pinned, now: now,
	}
}

// Check asks what this host is offered and decides what to do about it,
// without changing anything. It is what `runner update --check` prints and
// what the periodic loop calls.
func (s *Service) Check(ctx context.Context) (domain.Plan, error) {
	release, err := s.releases.Fetch(ctx, s.channel)
	if err != nil {
		return domain.Plan{}, err
	}
	state, _ := s.state.Load()
	plan := domain.Decide(s.version, release, s.pinned, s.activities.Snapshot(), state.WaitingSince, s.now())

	// Remember when waiting started, so the 24-hour cap survives restarts.
	if plan.Action == domain.ActionUpdate && state.WaitingSince.IsZero() {
		state.WaitingSince = s.now().UTC()
		_ = s.state.Save(state)
	}
	if plan.Action != domain.ActionUpdate && !state.WaitingSince.IsZero() {
		state.WaitingSince = time.Time{}
		_ = s.state.Save(state)
	}
	return plan, nil
}

// ApplyOptions tune a manual run.
type ApplyOptions struct {
	// Force applies a plan that would otherwise wait for a quiet moment or
	// respect a pin. It is what the console's Update now button and the CLI
	// `--force` mean; it never skips a signature or a digest.
	Force bool
}

// Apply performs the update: stage, verify, self-check, promote, activate,
// restart. It returns the plan it acted on. The restart ends this process, so
// anything after it happens in the next one, driven by NoteBoot.
func (s *Service) Apply(ctx context.Context, opts ApplyOptions) (domain.Plan, error) {
	plan, err := s.Check(ctx)
	if err != nil {
		return domain.Plan{}, err
	}
	switch plan.Action {
	case domain.ActionNone:
		return plan, nil
	case domain.ActionBlocked:
		if !opts.Force {
			return plan, domain.ErrBlocked.WithDetail("%s", plan.Reason)
		}
	case domain.ActionUpdate:
		if !opts.Force {
			return plan, nil // wait for a quiet moment; the loop will come back
		}
	case domain.ActionUpdateNow:
	}

	staged, err := s.binaries.Stage(ctx, plan.Release.Artifact, plan.Release.Version)
	if err != nil {
		return plan, err
	}
	if err := s.binaries.SelfCheck(ctx, staged); err != nil {
		return plan, domain.ErrSelfCheck.WithDetail(
			"the %s binary did not pass its own self-check, so it was not activated: %v", plan.Release.Version, err).WithCause(err)
	}
	if err := s.binaries.Promote(staged, plan.Release.Version); err != nil {
		return plan, domain.ErrActivate.WithDetail("%v", err).WithCause(err)
	}

	// Record the pending update *before* activating: if the swap or the
	// restart is interrupted, the next boot still knows what was going on.
	now := s.now().UTC()
	if err := s.state.Save(domain.State{
		From: s.version, To: plan.Release.Version, Phase: domain.PhasePending,
		StartedAt: now, ChangedAt: now,
	}); err != nil {
		return plan, domain.ErrActivate.WithDetail("record the update: %v", err).WithCause(err)
	}
	if err := s.binaries.Activate(plan.Release.Version); err != nil {
		return plan, domain.ErrActivate.WithDetail("%v", err).WithCause(err)
	}
	if s.restarter != nil {
		if err := s.restarter.Restart(ctx); err != nil {
			// The symlink already points at the new version, so the next
			// time the service manager starts the runner — including
			// KeepAlive or Restart=always after this process exits — it
			// runs it. Report, do not roll back.
			return plan, domain.ErrActivate.WithDetail(
				"%s is installed and linked, but the service manager refused a restart: %v", plan.Release.Version, err).WithCause(err)
		}
	}
	return plan, nil
}

// NoteBoot is called once per start by the daemon. It counts this boot
// against a pending update and rolls back when the new version has used up
// its attempts — which is how a release that crashes on one distro stops
// being that host's problem without anyone logging in.
func (s *Service) NoteBoot(ctx context.Context) (domain.State, error) {
	state, err := s.state.Load()
	if err != nil || state.Phase != domain.PhasePending {
		return state, nil //nolint:nilerr // no pending update is the normal path, not a failure
	}
	if state.To != s.version {
		// We are not running what the update installed — a rollback or a
		// manual change happened. Close the record rather than counting
		// boots of an unrelated binary.
		state.Phase, state.ChangedAt = domain.PhaseFailed, s.now().UTC()
		state.Error = "booted " + s.version + " while " + state.To + " was pending"
		return state, s.state.Save(state)
	}
	state.Attempts++
	state.ChangedAt = s.now().UTC()
	if err := s.state.Save(state); err != nil {
		return state, err
	}
	if state.ShouldRollBack(s.version) {
		return state, s.rollBack(ctx, state, "the new version did not stay up")
	}
	return state, nil
}

// MarkHealthy closes a pending update once the new binary has been up for the
// health gate. Until it is called, another boot counts as a failed attempt.
func (s *Service) MarkHealthy() error {
	state, err := s.state.Load()
	if err != nil || state.Phase != domain.PhasePending {
		return nil //nolint:nilerr // nothing pending is the normal path
	}
	state = state.Healthy(s.now().UTC())
	if err := s.state.Save(state); err != nil {
		return err
	}
	// Keep the running version and the one a rollback would return to.
	return s.binaries.Prune(state.To, state.From)
}

// Rollback returns to the previous version on request.
func (s *Service) Rollback(ctx context.Context) error {
	state, err := s.state.Load()
	if err != nil {
		return domain.ErrRolledBack.WithDetail("%v", err).WithCause(err)
	}
	if state.From == "" {
		return domain.ErrBlocked.WithDetail("there is no previous version on this host to roll back to")
	}
	return s.rollBack(ctx, state, "asked for")
}

func (s *Service) rollBack(ctx context.Context, state domain.State, reason string) error {
	if err := s.binaries.Activate(state.From); err != nil {
		return domain.ErrRolledBack.WithDetail(
			"could not return to %s: %v", state.From, err).WithCause(err)
	}
	state.Phase, state.ChangedAt = domain.PhaseRolled, s.now().UTC()
	state.Error = reason
	if err := s.state.Save(state); err != nil {
		return err
	}
	if s.restarter == nil {
		return nil
	}
	if err := s.restarter.Restart(ctx); err != nil {
		return domain.ErrRolledBack.WithDetail(
			"rolled back to %s but the service manager refused a restart: %v", state.From, err).WithCause(err)
	}
	return nil
}

// State exposes the record for `runner status`.
func (s *Service) State() (domain.State, error) {
	state, err := s.state.Load()
	if err != nil && !errors.Is(err, errNoState) {
		return domain.State{}, err
	}
	return state, nil
}

// errNoState lets State treat "never updated" as an empty record.
var errNoState = errors.New("no update has been recorded")

// ErrNoState is returned by a StateStore that has nothing recorded yet.
func ErrNoState() error { return errNoState }

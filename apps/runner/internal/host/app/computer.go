package app

import (
	"context"
	"errors"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ComputerPolicy is whether the host lets bots use its screen, as enforced.
func (s *Service) ComputerPolicy() (domain.ComputerPolicy, error) {
	if s.computers == nil {
		return domain.ComputerPolicy{}, nil
	}
	policy, err := s.computers.Load()
	if err != nil {
		return domain.ComputerPolicy{}, domain.ErrComputerPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return policy, nil
}

// SetComputerPolicy saves it, for `runner computer`.
func (s *Service) SetComputerPolicy(policy domain.ComputerPolicy) error {
	if s.computers == nil {
		return domain.ErrComputerPolicyFile.WithDetail("this runner keeps no computer setting")
	}
	if err := s.computers.Save(policy); err != nil {
		return domain.ErrComputerPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

// ComputerScreen is the screen bots would use, for `runner computer`: its
// size, or why there is none.
func (s *Service) ComputerScreen(ctx context.Context) (domain.Screen, error) {
	if s.desktop == nil {
		return domain.Screen{}, domain.ErrComputerNoScreen.WithDetail("the runner drives no screen on this platform")
	}
	screen, err := s.desktop.Screen(ctx)
	if err != nil {
		return domain.Screen{}, desktopProblem(err)
	}
	return screen, nil
}

// Computer does one action on the host's screen for a bot and answers with
// what the screen shows after it (`computer.act`, 25 §4.2). The setting is
// read from disk on every call, so `runner computer off` stops the next
// action without a restart, and it is checked before the screen is touched:
// a host that is off says nothing about what it has.
func (s *Service) Computer(ctx context.Context, req domain.ComputerRequest) (domain.Screenshot, error) {
	policy, err := s.ComputerPolicy()
	if err != nil {
		return domain.Screenshot{}, err
	}
	if !policy.Enabled {
		return domain.Screenshot{}, domain.ErrComputerOff.WithDetail(
			"the person on this host can turn it on with `runner computer on`")
	}
	if s.desktop == nil {
		return domain.Screenshot{}, domain.ErrComputerNoScreen.WithDetail("the runner drives no screen on this platform")
	}

	select {
	case s.desktopTurn <- struct{}{}:
		defer func() { <-s.desktopTurn }()
	case <-ctx.Done():
		return domain.Screenshot{}, ctx.Err()
	}

	screen, err := s.desktop.Screen(ctx)
	if err != nil {
		return domain.Screenshot{}, desktopProblem(err)
	}
	width, height := domain.FitScreen(screen.Width, screen.Height, req.MaxEdge)
	if err := req.Validate(width, height); err != nil {
		return domain.Screenshot{}, domain.ErrComputerAction.WithDetail("%v", err).WithCause(err)
	}

	switch req.Action {
	case domain.ComputerScreenshot:
	case domain.ComputerWait:
		if err := sleep(ctx, req.Wait); err != nil {
			return domain.Screenshot{}, err
		}
	default:
		if err := s.desktop.Act(ctx, req.ScaledTo(width, height, screen)); err != nil {
			return domain.Screenshot{}, desktopProblem(err)
		}
		if err := sleep(ctx, domain.ComputerSettle); err != nil {
			return domain.Screenshot{}, err
		}
	}

	shown, err := s.desktop.Capture(ctx)
	if err != nil {
		return domain.Screenshot{}, desktopProblem(err)
	}
	encoded, err := encodeScreen(shown, width, height, req.MaxBytes)
	if err != nil {
		return domain.Screenshot{}, domain.ErrComputerUnusable.WithDetail("%v", err).WithCause(err)
	}
	return domain.Screenshot{JPEG: encoded, Width: width, Height: height, Display: screen.Display}, nil
}

func desktopProblem(err error) error {
	if errors.Is(err, domain.ErrNoScreen) {
		return domain.ErrComputerNoScreen.WithDetail("%v", err).WithCause(err)
	}
	return domain.ErrComputerUnusable.WithDetail("%v", err).WithCause(err)
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

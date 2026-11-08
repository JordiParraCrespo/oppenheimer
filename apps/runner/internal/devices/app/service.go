// Package app is a session's device: which one it holds, its screen for a
// viewer, and the reader's input to it.
package app

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// Options are the service's ports and the devices this host offers.
type Options struct {
	Devices  []domain.Device
	Screens  Screens
	Controls Controls
	// Waker is optional: nil leaves the device as it is.
	Waker Waker
	// Finder is optional: nil offers Devices and no others. With one, the
	// offer is what it finds whenever a session asks for a device it does not
	// hold yet, so a simulator booted after the runner started is offered.
	Finder Finder
}

// findTimeout bounds one look at the host's devices.
const findTimeout = 10 * time.Second

// Service hands each session one device for its life and serves it.
type Service struct {
	mu       sync.Mutex
	pool     *domain.Pool
	screens  Screens
	controls Controls
	waker    Waker
	finder   Finder
}

// New builds the service over the host's devices.
func New(opts Options) *Service {
	return &Service{
		pool:     domain.NewPool(opts.Devices),
		screens:  opts.Screens,
		controls: opts.Controls,
		waker:    opts.Waker,
		finder:   opts.Finder,
	}
}

// ForSession is the session's device, taken from the free ones on first ask.
func (s *Service) ForSession(sessionID string) (domain.Device, error) {
	s.mu.Lock()
	if device, held := s.pool.Held(sessionID); held {
		s.mu.Unlock()
		return device, nil
	}
	s.mu.Unlock()
	// Looked for outside the lock: listing a host's devices takes a moment.
	var found []domain.Device
	var findErr error
	if s.finder != nil {
		ctx, cancel := context.WithTimeout(context.Background(), findTimeout)
		found, findErr = s.finder.Find(ctx)
		cancel()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	// A failed look keeps the last offer rather than taking every device away.
	if s.finder != nil && findErr == nil {
		s.pool.Offer(found)
	}
	device, err := s.pool.For(sessionID)
	if errors.Is(err, domain.ErrNoneFree) {
		return domain.Device{}, domain.ErrNoDevice.WithDetail("%s", err.Error())
	}
	return device, err
}

// Release frees the session's device, once the session is gone.
func (s *Service) Release(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pool.Release(sessionID)
}

// Watch opens the session's device screen for one viewer.
func (s *Service) Watch(ctx context.Context, sessionID string) (domain.Device, Screen, error) {
	device, err := s.ForSession(sessionID)
	if err != nil {
		return domain.Device{}, nil, err
	}
	if s.waker != nil {
		// Best effort: a device that cannot be woken may still be awake.
		_ = s.waker.Wake(ctx, device)
	}
	screen, err := s.screens.Open(ctx, device)
	if err != nil {
		return domain.Device{}, nil, domain.ErrUnreachable.WithDetail("%s", err.Error())
	}
	return device, screen, nil
}

// Input applies the reader's input to the session's own device. A session
// that holds no device has none to touch: input never takes a free one.
func (s *Service) Input(ctx context.Context, sessionID string, input domain.Input) error {
	if err := input.Validate(); err != nil {
		return domain.ErrInput.WithDetail("%s", err.Error())
	}
	s.mu.Lock()
	device, held := s.pool.Held(sessionID)
	s.mu.Unlock()
	if !held {
		return domain.ErrNoDevice
	}
	if err := s.controls.Apply(ctx, device, input); err != nil {
		return domain.ErrUnreachable.WithDetail("%s", err.Error())
	}
	return nil
}

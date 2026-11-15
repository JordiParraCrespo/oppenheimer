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
	// looks are the sessions whose device is being looked for outside the
	// lock; Release marks them, so a session that closes mid-look is not
	// handed a device it would hold for good.
	looks map[string]*look
}

// look is one session's lookups in flight.
type look struct {
	inFlight int
	released bool
}

// New builds the service over the host's devices.
func New(opts Options) *Service {
	return &Service{
		pool:     domain.NewPool(opts.Devices),
		screens:  opts.Screens,
		controls: opts.Controls,
		waker:    opts.Waker,
		finder:   opts.Finder,
		looks:    map[string]*look{},
	}
}

// ForSession is the session's device, taken from the free ones on first ask.
func (s *Service) ForSession(sessionID string) (domain.Device, error) {
	return s.forSession(sessionID, false)
}

// forSession is ForSession; fresh looks at the host's devices even for a
// session that holds one, so a viewer's list of them is current.
func (s *Service) forSession(sessionID string, fresh bool) (domain.Device, error) {
	s.mu.Lock()
	if device, held := s.pool.Held(sessionID); held && (!fresh || s.finder == nil) {
		s.mu.Unlock()
		return device, nil
	}
	l := s.beginLook(sessionID)
	s.mu.Unlock()
	found, ok := s.find()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.endLook(sessionID, l)
	if l.released {
		return domain.Device{}, domain.ErrNoDevice.WithDetail("the session closed before its device was found")
	}
	if ok {
		s.pool.Offer(found)
	}
	device, err := s.pool.For(sessionID)
	if errors.Is(err, domain.ErrNoneFree) {
		return domain.Device{}, domain.ErrNoDevice.WithDetail("%s", err.Error())
	}
	return device, err
}

// find is the host's devices now, when the service looks for them. Run
// outside the lock: listing a host's devices takes a moment. A failed look
// reports !ok, so the last offer stands rather than every device going away.
func (s *Service) find() ([]domain.Device, bool) {
	if s.finder == nil {
		return nil, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), findTimeout)
	defer cancel()
	found, err := s.finder.Find(ctx)
	return found, err == nil
}

// beginLook and endLook bracket one lookup for the session; s.mu is held.
func (s *Service) beginLook(sessionID string) *look {
	l := s.looks[sessionID]
	if l == nil {
		l = &look{}
		s.looks[sessionID] = l
	}
	l.inFlight++
	return l
}

func (s *Service) endLook(sessionID string, l *look) {
	l.inFlight--
	if l.inFlight == 0 && s.looks[sessionID] == l {
		delete(s.looks, sessionID)
	}
}

// Choices is every device this host offers as the session may pick it.
func (s *Service) Choices(sessionID string) []domain.Choice {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pool.Choices(sessionID)
}

// Held is the session's device, if it holds one.
func (s *Service) Held(sessionID string) (domain.Device, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pool.Held(sessionID)
}

// Choose moves the session onto another device the host offers, free or its
// own already; the device it held is freed for other sessions.
func (s *Service) Choose(sessionID, serial string) (domain.Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	device, err := s.pool.Choose(sessionID, serial)
	if err != nil {
		return domain.Device{}, domain.ErrNoDevice.WithDetail("%s", err.Error())
	}
	return device, nil
}

// Release frees the session's device, once the session is gone.
func (s *Service) Release(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pool.Release(sessionID)
	if l := s.looks[sessionID]; l != nil {
		l.released = true
		delete(s.looks, sessionID)
	}
}

// Watch opens the session's device screen for one viewer, after a fresh
// look at the host's devices, so Choices lists the ones booted since.
func (s *Service) Watch(ctx context.Context, sessionID string) (domain.Device, Screen, error) {
	device, err := s.forSession(sessionID, true)
	if err != nil {
		return domain.Device{}, nil, err
	}
	return s.open(ctx, device)
}

// WatchHeld opens the screen of the device the session holds now, without
// looking for another: the viewer just moved the session onto it.
func (s *Service) WatchHeld(ctx context.Context, sessionID string) (domain.Device, Screen, error) {
	s.mu.Lock()
	device, held := s.pool.Held(sessionID)
	s.mu.Unlock()
	if !held {
		return domain.Device{}, nil, domain.ErrNoDevice
	}
	return s.open(ctx, device)
}

// open wakes the device and opens its screen.
func (s *Service) open(ctx context.Context, device domain.Device) (domain.Device, Screen, error) {
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

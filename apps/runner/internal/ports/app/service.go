package app

import (
	"context"
	"net"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

// dialTimeout bounds a connection to a port the session listens on: it is
// on this machine, so anything slower is a server that stopped accepting.
const dialTimeout = 5 * time.Second

// Options are the service's dependencies.
type Options struct {
	Listeners Listeners
	Dialer    Dialer
}

// Service is a session's ports, for its preview.
type Service struct {
	listeners Listeners
	dialer    Dialer
}

// New builds the service.
func New(opts Options) *Service {
	dialer := opts.Dialer
	if dialer == nil {
		dialer = &net.Dialer{Timeout: dialTimeout}
	}
	return &Service{listeners: opts.Listeners, dialer: dialer}
}

// List is the ports the session's own processes listen on that a preview
// may reach, one per port, in order.
func (s *Service) List(ctx context.Context, sessionID string) ([]domain.Listener, error) {
	found, err := s.listeners.Of(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return domain.Dedupe(found), nil
}

// Open connects to one of the session's ports. The port is looked up again
// here, never taken from the caller's word: a preview reaches only what the
// session listens on now.
func (s *Service) Open(ctx context.Context, sessionID string, port int) (net.Conn, domain.Listener, error) {
	listeners, err := s.List(ctx, sessionID)
	if err != nil {
		return nil, domain.Listener{}, err
	}
	for _, l := range listeners {
		if l.Port != port {
			continue
		}
		ctx, cancel := context.WithTimeout(ctx, dialTimeout)
		defer cancel()
		conn, err := s.dialer.DialContext(ctx, "tcp", dialAddr(l.DialAddr()))
		if err != nil {
			return nil, l, domain.ErrUnreachable.WithDetail("localhost:%d: %v", port, err)
		}
		return conn, l, nil
	}
	return nil, domain.Listener{}, domain.ErrNotListening.WithDetail("localhost:%d", port)
}

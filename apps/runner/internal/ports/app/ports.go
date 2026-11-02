// Package app lists a session's ports and opens a connection to one.
package app

import (
	"context"
	"net"
	"net/netip"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

// Listeners reads the host's listening sockets held by a session's processes.
type Listeners interface {
	Of(ctx context.Context, sessionID string) ([]domain.Listener, error)
}

// Dialer connects to an address on this host.
type Dialer interface {
	DialContext(ctx context.Context, network, address string) (net.Conn, error)
}

var _ Dialer = (*net.Dialer)(nil)

// dialAddr is the string a Dialer takes for an address and port.
func dialAddr(addr netip.AddrPort) string { return addr.String() }

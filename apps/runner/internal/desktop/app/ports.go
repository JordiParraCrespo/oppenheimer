// Package app shares a host's desktop: it reads what the host's owner chose
// and opens a connection to the screen-sharing server, signed in.
package app

import (
	"context"
	"net"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

// SettingsStore keeps what `runner desktop` chose.
type SettingsStore interface {
	Load() (domain.Settings, error)
	Save(domain.Settings) error
}

// Secrets reads the server's password from the file the settings name.
type Secrets interface {
	Password(path string) (string, error)
}

// Dialer connects to an address on this host.
type Dialer interface {
	DialContext(ctx context.Context, network, address string) (net.Conn, error)
}

var _ Dialer = (*net.Dialer)(nil)

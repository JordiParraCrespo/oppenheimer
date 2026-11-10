package app

import (
	"context"
	"crypto/rand"
	"io"
	"net"
	"strconv"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

// signInTimeout bounds dialling and signing in to the server: it is on this
// machine, so anything slower is a server that stopped answering.
const signInTimeout = 10 * time.Second

// Options are the service's dependencies.
type Options struct {
	Settings SettingsStore
	Secrets  Secrets
	// Dialer defaults to a net.Dialer; Random to crypto/rand.
	Dialer Dialer
	Random io.Reader
}

// Service is the host's desktop, as the runner shares it.
type Service struct {
	settings SettingsStore
	secrets  Secrets
	dialer   Dialer
	random   io.Reader
}

// New builds the service.
func New(opts Options) *Service {
	s := &Service{settings: opts.Settings, secrets: opts.Secrets, dialer: opts.Dialer, random: opts.Random}
	if s.dialer == nil {
		s.dialer = &net.Dialer{Timeout: signInTimeout}
	}
	if s.random == nil {
		s.random = rand.Reader
	}
	return s
}

// Settings is what the host's owner chose; none saved is off.
func (s *Service) Settings() (domain.Settings, error) {
	settings, err := s.settings.Load()
	if err != nil {
		return domain.Settings{}, domain.ErrSettings.WithDetail("%v", err).WithCause(err)
	}
	return settings, nil
}

// SetSettings saves what the host's owner chose, for `runner desktop`.
func (s *Service) SetSettings(settings domain.Settings) error {
	if err := settings.Validate(); err != nil {
		return err
	}
	if err := s.settings.Save(settings); err != nil {
		return domain.ErrSettings.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

// Open connects to the host's screen-sharing server on its loopback and
// signs in with the host's credentials. The connection it returns waits for
// ClientInit, which is the browser's to send. Settings are read on every
// open; a desktop already open reads them again on its own (the link's
// desktopWatch), so `runner desktop off` reaches it too.
func (s *Service) Open(ctx context.Context) (net.Conn, error) {
	settings, err := s.Settings()
	if err != nil {
		return nil, err
	}
	if !settings.Enabled {
		return nil, domain.ErrOff.WithDetail("turn it on on the host: runner desktop on")
	}
	creds := domain.Credentials{Username: settings.Username}
	if settings.PasswordFile != "" {
		password, err := s.secrets.Password(settings.PasswordFile)
		if err != nil {
			return nil, domain.ErrSettings.WithDetail("the password file: %v", err).WithCause(err)
		}
		creds.Password = password
	}
	ctx, cancel := context.WithTimeout(ctx, signInTimeout)
	defer cancel()
	address := net.JoinHostPort("127.0.0.1", strconv.Itoa(settings.ServerPort()))
	conn, err := s.dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, domain.ErrUnreachable.WithDetail("%s: %v", address, err).WithCause(err)
	}
	deadline, _ := ctx.Deadline()
	_ = conn.SetDeadline(deadline)
	if err := domain.SignIn(conn, creds, s.random); err != nil {
		_ = conn.Close()
		return nil, err
	}
	_ = conn.SetDeadline(time.Time{})
	return conn, nil
}

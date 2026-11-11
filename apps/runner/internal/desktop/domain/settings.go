// Package domain is a host's desktop as the runner shares it: whether the
// host's owner shares it at all, which loopback port its screen-sharing
// server listens on, the credentials the runner signs in to it with, and the
// RFB (RFC 6143) the runner speaks to it and to the browser.
package domain

import (
	"strings"
)

// DefaultPort is where VNC servers listen unless told otherwise: macOS
// Screen Sharing always, TigerVNC and x11vnc for display :0.
const DefaultPort = 5900

// maxCredential is what one ARD credential field holds: 64 bytes, one of
// them the terminating NUL.
const maxCredential = 63

// Settings are what the host's owner chose with `runner desktop`. Nothing
// on the link writes them: whether a host's screen can be watched and driven
// from the console is decided on the host.
type Settings struct {
	// Enabled shares the desktop. Off, `desktop.open` is DESKTOP_001.
	Enabled bool `json:"enabled"`
	// Port is the loopback port of the screen-sharing server; 0 is DefaultPort.
	Port int `json:"port,omitempty"`
	// Username is the account an Apple Remote Desktop server (macOS Screen
	// Sharing) signs in; a plain VNC password needs none.
	Username string `json:"username,omitempty"`
	// PasswordFile holds the server's password, readable by this account
	// only. Empty is a server that asks for none.
	PasswordFile string `json:"passwordFile,omitempty"`
}

// ServerPort is the port to dial.
func (s Settings) ServerPort() int {
	if s.Port == 0 {
		return DefaultPort
	}
	return s.Port
}

// Validate refuses settings the runner could not act on.
func (s Settings) Validate() error {
	if s.Port != 0 && (s.Port < 1 || s.Port > 65535) {
		return ErrInvalidInput.WithDetail("port %d is not a TCP port", s.Port)
	}
	if len(s.Username) > maxCredential || strings.ContainsRune(s.Username, 0) {
		return ErrInvalidInput.WithDetail("the username must be at most %d bytes", maxCredential)
	}
	return nil
}

// Credentials are what the runner signs in to the server with.
type Credentials struct {
	Username string
	Password string
}

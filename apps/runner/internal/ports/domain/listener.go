// Package domain is what a session's forwarded ports are: the TCP listeners
// its own processes hold, and which of them a preview may reach.
package domain

import (
	"bytes"
	"net/netip"
	"sort"
)

// MinPort is the lowest port a preview reaches. Below it are the services a
// machine runs for itself, which no session opened.
const MinPort = 1024

// SessionEnv is the variable every process of a session carries: tmux sets it
// for the session's panes, and whatever the agent starts inherits it, a
// daemonized server included.
const SessionEnv = "OPPENHEIMER_SESSION"

// Listener is one listening TCP socket a session's process holds.
type Listener struct {
	Port int
	// Addr is the address it is bound to: a loopback, or unspecified (all).
	Addr netip.Addr
	// Process is the command's name, for the console ("node", "vite").
	Process string
	PID     int
}

// DialAddr is where the runner connects to reach it: the address it is bound
// to, or the loopback of its family when it listens on every address.
func (l Listener) DialAddr() netip.AddrPort {
	addr := l.Addr
	if addr.IsUnspecified() || !addr.IsValid() {
		if addr.Is6() {
			addr = netip.IPv6Loopback()
		} else {
			addr = netip.AddrFrom4([4]byte{127, 0, 0, 1})
		}
	}
	return netip.AddrPortFrom(addr, uint16(l.Port&0xffff)) //nolint:gosec // a TCP port, and Reachable holds it to 65535
}

// Reachable is whether a preview may dial this listener from the host: a
// port from MinPort up, bound to a loopback or to every address. One bound
// to a single other interface (a LAN address) is the network's, not the
// host's own, and is left out.
func (l Listener) Reachable() bool {
	if l.Port < MinPort || l.Port > 65535 {
		return false
	}
	return l.Addr.IsLoopback() || l.Addr.IsUnspecified()
}

// OwnedBy reports whether a process environment (NUL-separated, as
// /proc/<pid>/environ holds it) names the session.
func OwnedBy(environ []byte, sessionID string) bool {
	want := []byte(SessionEnv + "=" + sessionID)
	for _, entry := range bytes.Split(environ, []byte{0}) {
		if bytes.Equal(entry, want) {
			return true
		}
	}
	return false
}

// Dedupe keeps one listener per port, preferring a loopback IPv4 one, the
// address `localhost` dials first, and sorts them by port.
func Dedupe(listeners []Listener) []Listener {
	byPort := map[int]Listener{}
	for _, l := range listeners {
		if !l.Reachable() {
			continue
		}
		have, ok := byPort[l.Port]
		if !ok || rank(l) < rank(have) {
			byPort[l.Port] = l
		}
	}
	out := make([]Listener, 0, len(byPort))
	for _, l := range byPort {
		out = append(out, l)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Port < out[j].Port })
	return out
}

func rank(l Listener) int {
	switch {
	case l.Addr.Is4() && l.Addr.IsLoopback():
		return 0
	case l.Addr.Is4():
		return 1
	case l.Addr.IsLoopback():
		return 2
	default:
		return 3
	}
}

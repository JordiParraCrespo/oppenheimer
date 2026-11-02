// Package domain is what a session's device is: a simulator or emulator this
// host offers, held by at most one session at a time
// (product/research/device-streaming.md).
package domain

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

// Platform is the device's operating system.
type Platform string

const (
	Android Platform = "android"
	IOS     Platform = "ios"
)

// Device is one simulator or emulator this host offers to sessions.
type Device struct {
	// Serial is the host's id for it: an adb serial, a simulator UDID.
	Serial   string
	Name     string
	Platform Platform
}

// ErrNoneFree is a session asking for a device when every one is held.
var ErrNoneFree = errors.New("every device on this host belongs to another session")

// ParseDevices reads the host's offer: comma-separated serials, each
// optionally `serial=Name`. An emulator serial is Android; anything else is
// taken as an iOS simulator UDID.
func ParseDevices(spec string) ([]Device, error) {
	var devices []Device
	for _, entry := range strings.Split(spec, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		serial, name, _ := strings.Cut(entry, "=")
		serial, name = strings.TrimSpace(serial), strings.TrimSpace(name)
		if serial == "" {
			return nil, fmt.Errorf("device %q has no serial", entry)
		}
		platform := IOS
		if strings.HasPrefix(serial, "emulator-") {
			platform = Android
		}
		if name == "" {
			name = map[Platform]string{Android: "Android emulator", IOS: "iOS simulator"}[platform]
		}
		if slices.ContainsFunc(devices, func(d Device) bool { return d.Serial == serial }) {
			return nil, fmt.Errorf("device %q is listed twice", serial)
		}
		devices = append(devices, Device{Serial: serial, Name: name, Platform: platform})
	}
	return devices, nil
}

// Pool is which session holds which device. A session keeps its device for
// its whole life, so its agent and its reader always reach the same one, and
// no two sessions ever share one.
type Pool struct {
	devices []Device
	holders map[string]string // serial → session id
}

// NewPool offers devices, none held.
func NewPool(devices []Device) *Pool {
	return &Pool{devices: slices.Clone(devices), holders: map[string]string{}}
}

// For is the session's device: the one it holds, or the first free one,
// which it then holds.
func (p *Pool) For(sessionID string) (Device, error) {
	for _, d := range p.devices {
		if p.holders[d.Serial] == sessionID {
			return d, nil
		}
	}
	for _, d := range p.devices {
		if _, held := p.holders[d.Serial]; !held {
			p.holders[d.Serial] = sessionID
			return d, nil
		}
	}
	return Device{}, ErrNoneFree
}

// Held is the session's device, if it holds one, without taking a free one.
func (p *Pool) Held(sessionID string) (Device, bool) {
	for _, d := range p.devices {
		if p.holders[d.Serial] == sessionID {
			return d, true
		}
	}
	return Device{}, false
}

// Release frees whatever the session held.
func (p *Pool) Release(sessionID string) {
	for serial, holder := range p.holders {
		if holder == sessionID {
			delete(p.holders, serial)
		}
	}
}

package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// Screen is one viewer's stream of a device's screen.
type Screen interface {
	// Next blocks until the next whole frame, a JPEG image, and returns it.
	// It returns the context's error once ctx ends, and any other error once
	// the stream is over.
	Next(ctx context.Context) ([]byte, error)
	Close() error
}

// Screens opens a device's screen stream.
type Screens interface {
	Open(ctx context.Context, device domain.Device) (Screen, error)
}

// Controls applies an input to a device.
type Controls interface {
	Apply(ctx context.Context, device domain.Device, input domain.Input) error
}

// Waker readies a device to be watched: a sleeping display sends no frames.
type Waker interface {
	Wake(ctx context.Context, device domain.Device) error
}

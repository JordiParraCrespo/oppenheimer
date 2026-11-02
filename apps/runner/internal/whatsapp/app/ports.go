// Package app holds the host's WhatsApp linked device: pairing it, keeping it
// connected, handing the control plane every message that arrives and sending
// what the control plane asks (product/next-steps/whatsapp.md).
package app

import (
	"context"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// Paired is the stored device, when there is one.
type Paired struct {
	// Phone is the number's JID; empty is no device stored.
	Phone string
	Name  string
}

// Device is the WhatsApp linked device: whatsmeow over the WhatsApp Web
// multi-device protocol, with its keys in a file only the runner's user reads.
type Device interface {
	// Open reads the stored device, if any, and starts telling events what
	// happens to it. It does not connect.
	Open(ctx context.Context, events Events) (Paired, error)
	// Connect brings a stored device online, and keeps it online, reconnecting
	// on its own, until ctx ends, it is logged out, or Close.
	Connect(ctx context.Context) error
	// Pair makes a fresh device and waits for the phone to scan one of the
	// codes it hands onCode, each valid until its expiry. It returns the
	// paired number once the phone scanned one (Events.Connected follows), or
	// why pairing ended.
	Pair(ctx context.Context, onCode func(code string, expires time.Time)) (Paired, error)
	// Logout removes the device from the phone's linked devices and deletes
	// its keys, which it does even when WhatsApp cannot be reached.
	Logout(ctx context.Context) error
	// Send sends a text message to a chat; the id and time are WhatsApp's.
	Send(ctx context.Context, chatID, text string) (id string, at time.Time, err error)
	Close()
}

// Events is what the device tells the service.
type Events interface {
	Received(domain.Received)
	Connected(phone, name string)
	Disconnected()
	LoggedOut(reason string)
}

// Outbox keeps the messages the control plane has not acknowledged, on disk,
// so neither a dropped link nor a restart loses one.
type Outbox interface {
	// Put keeps a message; one already kept under its key is left as it is.
	Put(ctx context.Context, message domain.Inbound) error
	// Pending is up to limit messages, oldest first.
	Pending(ctx context.Context, limit int) ([]domain.Inbound, error)
	// Ack forgets the messages under keys.
	Ack(ctx context.Context, keys []string) error
	// Clear forgets every message waiting.
	Clear(ctx context.Context) error
}

// Publisher is the control-plane link, as the service reaches it.
type Publisher interface {
	// State tells the control plane how the device stands.
	State(domain.Status)
	// Messages hands it a batch, and reports whether the link took it.
	Messages([]domain.Inbound) bool
}

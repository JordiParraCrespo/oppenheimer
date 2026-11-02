// Package domain is the WhatsApp linked device's rules: how it stands, which
// messages it hands the control plane and in what shape, and how many it may
// send (product/next-steps/whatsapp.md). It knows nothing of whatsmeow.
package domain

import "time"

// State is how the linked device stands, as `whatsapp.state` names it.
type State string

const (
	StateUnlinked   State = "unlinked"
	StatePairing    State = "pairing"
	StateConnecting State = "connecting"
	StateConnected  State = "connected"
	StateLoggedOut  State = "logged_out"
)

// Status is the device's state with what goes with it: the QR code while
// pairing, the number and name once paired, why it was lost.
type Status struct {
	State       State
	QR          string
	QRExpiresAt time.Time
	Phone       string
	Name        string
	Reason      string
}

// Package domain is the host's Telegram bot's rules: how it stands, which
// updates it hands the control plane and in what shape, and how fast it may
// send (product/next-steps/telegram.md). It knows nothing of HTTP.
package domain

// State is how the bot stands, as `telegram.state` names it.
type State string

const (
	StateUnlinked   State = "unlinked"
	StateConnecting State = "connecting"
	StateConnected  State = "connected"
	StateRevoked    State = "revoked"
)

// Bot is the bot a token belongs to, as Telegram's getMe names it.
type Bot struct {
	ID       string
	Username string
	Name     string
}

// Status is the bot's state with what goes with it: the bot once its token
// was checked, why it was lost.
type Status struct {
	State  State
	Bot    Bot
	Reason string
}

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

// Event is what the poller learns about the bot while it holds a token.
type Event int

const (
	// Polled is a poll Telegram answered.
	Polled Event = iota
	// PollFailed is a poll that did not get through (network, a 5xx, a 429).
	PollFailed
	// TokenRefused is Telegram answering 401: the token was revoked.
	TokenRefused
)

// RevokedReason is what a revoked bot says.
const RevokedReason = "Telegram refused the token: it was revoked in @BotFather"

// On is how the bot stands after e, and whether that changed anything worth
// reporting. A bot disconnected from Oppenheimer stays unlinked whatever a
// poller still running says; a failed poll only matters to a connected bot.
func (s Status) On(e Event) (Status, bool) {
	if s.State == StateUnlinked {
		return s, false
	}
	switch e {
	case Polled:
		if s.State == StateConnected {
			return s, false
		}
		return Status{State: StateConnected, Bot: s.Bot}, true
	case PollFailed:
		if s.State != StateConnected {
			return s, false
		}
		return Status{State: StateConnecting, Bot: s.Bot}, true
	case TokenRefused:
		next := Status{State: StateRevoked, Bot: s.Bot, Reason: RevokedReason}
		return next, next != s
	}
	return s, false
}

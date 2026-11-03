package domain

import "time"

// WakeRequestedKind is the event kind a wake an agent set for itself is
// logged as (`runner sessions wake-in`, `product/next-steps/agent-tools.md`
// §4).
const WakeRequestedKind = "wake.requested"

const (
	// WakeMinDelay and WakeMaxDelay bound how long an agent may sleep: not
	// less than a minute (the control plane's wakes are minutes apart), not
	// more than a week.
	WakeMinDelay = time.Minute
	WakeMaxDelay = 7 * 24 * time.Hour
	// WakeTextMaxBytes bounds the agent's note to itself.
	WakeTextMaxBytes = 1000
)

// WakeRequest is one wake: its id, when (RFC 3339, UTC), and the words typed
// back into the session then.
type WakeRequest struct {
	ID   string `json:"id"`
	At   string `json:"at"`
	Text string `json:"text"`
}

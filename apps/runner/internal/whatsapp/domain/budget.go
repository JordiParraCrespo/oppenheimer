package domain

import (
	"errors"
	"sync"
	"time"
)

// ErrRateLimited is WhatsApp answering a send with a 429 (`rate-overlimit`):
// the number is sending too fast for WhatsApp, and every send pauses.
var ErrRateLimited = errors.New("WhatsApp is rate limiting this number")

// RateLimitPause is how long sends stop after WhatsApp's 429. WhatsApp names
// no reset; ten minutes is long enough not to look like a client that keeps
// pushing, which is what turns a limit into a ban.
const RateLimitPause = 10 * time.Minute

// The host's own limit on what its device sends. WhatsApp publishes none for
// a linked device and OpenClaw keeps none; the cost of going over is the
// number being banned, so these are the number. Twenty a minute is a person
// answering several chats quickly; three hundred a day is far past what one
// person's assistant answers, and far short of what a spammer sends.
const (
	SendsPerMinute = 20
	SendsPerDay    = 300
)

// Budget counts sends in a sliding minute and a sliding day.
type Budget struct {
	mu        sync.Mutex
	perMinute int
	perDay    int
	sent      []time.Time
	pausedTo  time.Time
}

// NewBudget is a budget of perMinute and perDay sends.
func NewBudget(perMinute, perDay int) *Budget {
	return &Budget{perMinute: perMinute, perDay: perDay}
}

// Take spends one send at now, or reports false and spends nothing when
// either window is full.
func (b *Budget) Take(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	dayAgo, minuteAgo := now.Add(-24*time.Hour), now.Add(-time.Minute)
	kept := b.sent[:0]
	inMinute := 0
	for _, at := range b.sent {
		if at.After(dayAgo) {
			kept = append(kept, at)
			if at.After(minuteAgo) {
				inMinute++
			}
		}
	}
	b.sent = kept
	if now.Before(b.pausedTo) {
		return false
	}
	if len(b.sent) >= b.perDay || inMinute >= b.perMinute {
		return false
	}
	b.sent = append(b.sent, now)
	return true
}

// Refund gives back the send taken at at, for a message WhatsApp never took.
func (b *Budget) Refund(at time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i := len(b.sent) - 1; i >= 0; i-- {
		if b.sent[i].Equal(at) {
			b.sent = append(b.sent[:i], b.sent[i+1:]...)
			return
		}
	}
}

// PauseUntil refuses every send until until.
func (b *Budget) PauseUntil(until time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if until.After(b.pausedTo) {
		b.pausedTo = until
	}
}

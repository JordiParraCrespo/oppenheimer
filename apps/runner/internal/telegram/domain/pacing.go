package domain

import (
	"sync"
	"time"
)

// Telegram's own limits on what a bot sends, kept on the host so a bot is
// paced rather than refused: about one message a second to a chat, twenty a
// minute to a group (core.telegram.org/bots/faq). There is no number to lose,
// so there is no daily budget; a 429 pauses every send for its retry_after.
const (
	ChatInterval   = time.Second
	GroupPerMinute = 20
	// MaxWait is the longest a send waits for its turn; past it the send is
	// refused, with when to try again.
	MaxWait = 5 * time.Second
)

// Pacer spaces a bot's sends to Telegram's limits.
type Pacer struct {
	mu       sync.Mutex
	last     map[string]time.Time
	groups   map[string][]time.Time
	pausedTo time.Time
}

// NewPacer is a pacer with nothing sent.
func NewPacer() *Pacer {
	return &Pacer{last: map[string]time.Time{}, groups: map[string][]time.Time{}}
}

// Reserve books a send to chatID at the earliest moment the limits allow and
// returns how long from now that is. It books nothing and reports false when
// that is more than MaxWait away, with the wait it would have been.
func (p *Pacer) Reserve(chatID string, now time.Time) (time.Duration, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	at := now
	if p.pausedTo.After(at) {
		at = p.pausedTo
	}
	if last, ok := p.last[chatID]; ok && last.Add(ChatInterval).After(at) {
		at = last.Add(ChatInterval)
	}
	var sent []time.Time
	if IsGroupChat(chatID) {
		minuteAgo := now.Add(-time.Minute)
		for _, t := range p.groups[chatID] {
			if t.After(minuteAgo) {
				sent = append(sent, t)
			}
		}
		p.groups[chatID] = sent
		if len(sent) >= GroupPerMinute {
			if free := sent[len(sent)-GroupPerMinute].Add(time.Minute); free.After(at) {
				at = free
			}
		}
	}
	wait := at.Sub(now)
	if wait > MaxWait {
		return wait, false
	}
	p.last[chatID] = at
	if IsGroupChat(chatID) {
		p.groups[chatID] = append(sent, at)
	}
	return wait, true
}

// PauseUntil refuses to book any send before until.
func (p *Pacer) PauseUntil(until time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if until.After(p.pausedTo) {
		p.pausedTo = until
	}
}

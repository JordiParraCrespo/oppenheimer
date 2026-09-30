package link_test

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// clock is a reporter clock a test moves by hand.
type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func newClockedReporter(sender link.Sender) (*link.Reporter, *clock) {
	r := link.NewReporter("run", sender, nil)
	c := &clock{now: time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)}
	link.SetReporterClock(r, c.Now)
	return r, c
}

func sentKeys(s *fakeSender) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	keys := make([]string, 0, len(s.sent))
	for _, batch := range s.sent {
		keys = append(keys, batch.Events[0].IdempotencyKey)
	}
	return keys
}

// A link that stays up and never answers a batch — its ack lost, the batch
// dropped on the other side — does not strand it until the link happens to
// drop: past the ack timeout, Retry sends it again.
func TestAnUnackedBatchIsSentAgainAfterTheAckTimeout(t *testing.T) {
	sender := &fakeSender{}
	r, c := newClockedReporter(sender)
	timeout := link.ReporterAckTimeout
	if timeout <= 0 {
		t.Fatal("the reporter has no ack timeout")
	}
	r.Append("s1", "session.started", map[string]any{})

	c.advance(timeout - time.Second)
	r.Retry()
	if keys := sentKeys(sender); len(keys) != 1 {
		t.Fatalf("resent %v before the ack timeout", keys)
	}

	c.advance(time.Second)
	r.Retry()
	if keys := sentKeys(sender); len(keys) != 2 || keys[1] != "run:1" {
		t.Fatalf("sent %v, want run:1 sent again once the ack is overdue", keys)
	}
	if r.Pending() != 1 || r.Unsent() != 0 {
		t.Fatalf("pending=%d unsent=%d; resent and still awaiting its ack", r.Pending(), r.Unsent())
	}

	// The resend restarts the wait: the next retry does not send it a third time.
	r.Retry()
	if keys := sentKeys(sender); len(keys) != 2 {
		t.Fatalf("a retry right after a resend sent %v", keys)
	}
}

// A resend keeps the order the batches were made in: the overdue batch goes
// again with every batch made after it, never behind them.
func TestAnAckTimeoutResendsInOrderFromTheOverdueBatch(t *testing.T) {
	sender := &fakeSender{}
	r, c := newClockedReporter(sender)
	timeout := link.ReporterAckTimeout

	r.Append("s1", "session.step", map[string]any{"i": 1}) // run:1, acked below
	r.Append("s1", "session.step", map[string]any{"i": 2}) // run:2, never acked
	c.advance(timeout / 2)
	r.Append("s1", "session.step", map[string]any{"i": 3}) // run:3, not yet overdue
	r.Append("s1", "session.step", map[string]any{"i": 4}) // run:4, acked below
	sent := sentKeys(sender)
	r.Ack(link.EventsAck{BatchID: sender.sent[0].BatchID, Accepted: []string{sent[0]}})
	r.Ack(link.EventsAck{BatchID: sender.sent[3].BatchID, Accepted: []string{sent[3]}})

	c.advance(timeout / 2)
	r.Retry()

	keys := sentKeys(sender)[4:]
	if want := []string{"run:2", "run:3"}; fmt.Sprint(keys) != fmt.Sprint(want) {
		t.Fatalf("resent %v, want %v: the overdue batch, then what was made after it", keys, want)
	}
}

// tooLargeSender refuses one batch as over the frame cap and takes the rest.
type tooLargeSender struct {
	fakeSender
	refuse string
}

func (s *tooLargeSender) Send(message any) error {
	if message.(link.EventsAppend).Events[0].IdempotencyKey == s.refuse {
		return link.ErrFrameTooLarge
	}
	return s.fakeSender.Send(message)
}

// A batch no link will ever carry is dropped, not retried forever ahead of
// every batch made after it.
func TestABatchOverTheFrameCapIsDroppedNotHeldAhead(t *testing.T) {
	sender := &tooLargeSender{refuse: "run:1"}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.step", map[string]any{"i": 1})
	r.Append("s1", "session.step", map[string]any{"i": 2})
	if keys := sentKeys(&sender.fakeSender); fmt.Sprint(keys) != "[run:2]" {
		t.Fatalf("sent %v, want only run:2", keys)
	}
	if r.Pending() != 1 || r.Unsent() != 0 {
		t.Fatalf("pending=%d unsent=%d; the oversized batch must be gone", r.Pending(), r.Unsent())
	}
}

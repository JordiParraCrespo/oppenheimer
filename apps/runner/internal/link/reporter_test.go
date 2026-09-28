package link_test

import (
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

type fakeSender struct {
	mu   sync.Mutex
	sent []link.EventsAppend
	fail bool
}

func (s *fakeSender) Send(message any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fail {
		return errors.New("down")
	}
	s.sent = append(s.sent, message.(link.EventsAppend))
	return nil
}

func TestEveryEventCarriesARunScopedKey(t *testing.T) {
	sender := &fakeSender{}
	r := link.NewReporter("run-7f3a", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	r.Append("s1", "agent.observed", map[string]any{"state": "working"})
	if len(sender.sent) != 2 {
		t.Fatalf("sent %d batches", len(sender.sent))
	}
	if key := sender.sent[0].Events[0].IdempotencyKey; key != "run-7f3a:1" {
		t.Fatalf("first key = %s", key)
	}
	if key := sender.sent[1].Events[0].IdempotencyKey; key != "run-7f3a:2" {
		t.Fatalf("second key = %s", key)
	}
	if payload := sender.sent[1].Events[0].Payload; payload != `{"state":"working"}` {
		t.Fatalf("payload is a JSON string: %s", payload)
	}
	if r.Pending() != 2 {
		t.Fatalf("both batches await an ack, pending=%d", r.Pending())
	}
}

func TestAnAckByKeySettlesTheBatch(t *testing.T) {
	sender := &fakeSender{}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	batch := sender.sent[0]
	r.Ack(link.EventsAck{Type: "events.ack", BatchID: batch.BatchID, Accepted: []string{"run:1"}})
	if r.Pending() != 0 {
		t.Fatalf("acked batch still pending")
	}
	// An ack for a batch nobody sent is ignored.
	r.Ack(link.EventsAck{BatchID: "ghost", Accepted: []string{"x:1"}})
}

func TestARejectedKeyIsDroppedNotResent(t *testing.T) {
	sender := &fakeSender{}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	ack := link.EventsAck{BatchID: sender.sent[0].BatchID}
	ack.Rejected = append(ack.Rejected, struct {
		IdempotencyKey string `json:"idempotencyKey"`
		Reason         string `json:"reason"`
	}{"run:1", "no such session on this host"})
	r.Ack(ack)
	if r.Pending() != 0 {
		t.Fatal("a rejected batch must not be resent")
	}
}

func TestUnackedBatchesAreResentAfterAReconnect(t *testing.T) {
	sender := &fakeSender{fail: true}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	r.Append("s1", "agent.observed", map[string]any{"state": "idle"})
	if len(sender.sent) != 0 || r.Pending() != 2 {
		t.Fatalf("nothing should have left while the link was down")
	}
	sender.mu.Lock()
	sender.fail = false
	sender.mu.Unlock()
	r.Resend()
	if len(sender.sent) != 2 {
		t.Fatalf("resend sent %d batches, want 2", len(sender.sent))
	}
	keys := map[string]bool{}
	for _, batch := range sender.sent {
		keys[batch.Events[0].IdempotencyKey] = true
	}
	if !keys["run:1"] || !keys["run:2"] {
		t.Fatalf("resent keys = %v", keys)
	}
}

// A session's log is ordered by arrival, so a resend replays batches in the
// order they were made — a start's `running` never lands after its `done`.
func TestResendKeepsTheOrderTheBatchesWereMadeIn(t *testing.T) {
	sender := &fakeSender{fail: true}
	r := link.NewReporter("run", sender, nil)
	for i := 0; i < 20; i++ {
		r.Append("s1", "session.step", map[string]any{"i": i})
	}
	sender.mu.Lock()
	sender.fail = false
	sender.mu.Unlock()
	r.Resend()
	if len(sender.sent) != 20 {
		t.Fatalf("resend sent %d batches, want 20", len(sender.sent))
	}
	for i, batch := range sender.sent {
		if want := fmt.Sprintf("run:%d", i+1); batch.Events[0].IdempotencyKey != want {
			t.Fatalf("batch %d carries %s, want %s", i, batch.Events[0].IdempotencyKey, want)
		}
	}
}

// refusingSender refuses the next `refuse` sends with backpressure, as a full
// control queue on a link that stays up does, and takes the rest.
type refusingSender struct {
	mu     sync.Mutex
	refuse int
	calls  int
	sent   []link.EventsAppend
}

func (s *refusingSender) Send(message any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	if s.refuse > 0 {
		s.refuse--
		return link.ErrBackpressure
	}
	s.sent = append(s.sent, message.(link.EventsAppend))
	return nil
}

func (s *refusingSender) keys() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	keys := make([]string, 0, len(s.sent))
	for _, batch := range s.sent {
		keys = append(keys, batch.Events[0].IdempotencyKey)
	}
	return keys
}

// A full queue on a link that stays up is not a reconnect: the batch is sent
// again on the next retry, not hours later when the link happens to drop.
func TestBatchRefusedWithBackpressureIsRetriedWhileConnected(t *testing.T) {
	sender := &refusingSender{refuse: 1}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	if r.Unsent() != 1 {
		t.Fatalf("unsent = %d, want the refused batch held", r.Unsent())
	}

	r.Retry()

	if keys := sender.keys(); len(keys) != 1 || keys[0] != "run:1" {
		t.Fatalf("sent %v, want the refused batch sent on retry", keys)
	}
	if r.Unsent() != 0 || r.Pending() != 1 {
		t.Fatalf("unsent = %d, pending = %d; sent but not yet acked", r.Unsent(), r.Pending())
	}
	// Taken once is taken: a retry does not send it twice on the same link.
	r.Retry()
	if keys := sender.keys(); len(keys) != 1 {
		t.Fatalf("a retry resent a batch the link already took: %v", keys)
	}
}

// A batch the link refused holds back every batch made after it, so the
// control plane never records a session's events out of order.
func TestFlushKeepsOrderBehindAnUnsentBatch(t *testing.T) {
	sender := &refusingSender{refuse: 1}
	r := link.NewReporter("run", sender, nil)
	r.Append("s1", "session.started", map[string]any{})
	r.Append("s1", "agent.observed", map[string]any{"state": "working"})

	if keys := sender.keys(); len(keys) != 2 || keys[0] != "run:1" || keys[1] != "run:2" {
		t.Fatalf("sent %v, want batch 1 before batch 2", keys)
	}
}

func TestResendStopsAtTheFirstRefusal(t *testing.T) {
	sender := &refusingSender{refuse: 100}
	r := link.NewReporter("run", sender, nil)
	for i := 0; i < 10; i++ {
		r.Append("s1", "session.step", map[string]any{"i": i})
	}
	sender.mu.Lock()
	sender.calls, sender.refuse = 0, 1
	sender.mu.Unlock()

	r.Resend()

	sender.mu.Lock()
	calls := sender.calls
	sender.mu.Unlock()
	if calls != 1 {
		t.Fatalf("resend tried %d sends past a refusal, want 1", calls)
	}
	if r.Unsent() != 10 {
		t.Fatalf("unsent = %d, want all 10 still held", r.Unsent())
	}
	r.Retry()
	keys := sender.keys()
	if len(keys) != 10 {
		t.Fatalf("retry sent %d batches, want 10", len(keys))
	}
	for i, key := range keys {
		if want := fmt.Sprintf("run:%d", i+1); key != want {
			t.Fatalf("batch %d carries %s, want %s", i, key, want)
		}
	}
}

func TestPendingIsBounded(t *testing.T) {
	sender := &fakeSender{fail: true}
	r := link.NewReporter("run", sender, nil)
	link.SetReporterLimit(r, 3)
	for i := 0; i < 5; i++ {
		r.Append("s1", "session.step", map[string]any{"i": i})
	}
	if r.Pending() != 3 {
		t.Fatalf("pending = %d, want the cap of 3", r.Pending())
	}
	sender.mu.Lock()
	sender.fail = false
	sender.mu.Unlock()
	r.Resend()
	// The oldest went; what is left is the newest, still in order.
	if len(sender.sent) != 3 {
		t.Fatalf("resend sent %d batches, want 3", len(sender.sent))
	}
	for i, batch := range sender.sent {
		if want := fmt.Sprintf("run:%d", i+3); batch.Events[0].IdempotencyKey != want {
			t.Fatalf("batch %d carries %s, want %s", i, batch.Events[0].IdempotencyKey, want)
		}
	}
}

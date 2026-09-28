package link

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

// Sender is the slice of Client the reporter needs, so tests can stand in.
type Sender interface {
	Send(message any) error
}

// maxPendingBatches bounds what the reporter holds while the link is gone for
// long. The runner keeps no durable outbox and the next hello's snapshot
// reconciles (02-runner §4), so past the cap the oldest batch is dropped — and
// the log says which, never silently.
const maxPendingBatches = 4096

// Reporter batches a session's events and keeps every batch until an ack
// accounts for each of its keys (01, "events.append and events.ack"). Keys
// are `<runId>:<n>`: `runId` is minted at process start and `n` is this
// process's own counter, so a replay after a lost ack is de-duplicated by the
// control plane and no key depends on anything the link assigned.
type Reporter struct {
	runID  string
	sender Sender
	logger *slog.Logger
	now    func() time.Time
	seq    atomic.Uint64

	// mu is held across a flush, sends included — Send never blocks — so two
	// flushes cannot interleave and put a newer batch ahead of an older one.
	mu sync.Mutex
	// pending holds every batch until fully acked, in the order it was made:
	// the control plane records a link's batches as they arrive, and that is
	// the log's order — a start's `running` must not land after its `done`.
	pending []*pendingBatch
	batches atomic.Uint64
	// limit is maxPendingBatches; a field so a test need not make 4096.
	limit int
}

// pendingBatch is a batch awaiting its ack. queued says the link that is up
// took it; one the link refused is not, and the next flush tries it again.
type pendingBatch struct {
	batch  EventsAppend
	queued bool
}

// NewReporter builds a reporter for one process.
func NewReporter(runID string, sender Sender, logger *slog.Logger) *Reporter {
	if logger == nil {
		logger = slog.Default()
	}
	return &Reporter{runID: runID, sender: sender, logger: logger, now: time.Now, limit: maxPendingBatches}
}

// RunID is the id every key starts with.
func (r *Reporter) RunID() string { return r.runID }

// Append records one event for a session in its own batch, then sends what
// the link has not taken, oldest first: a new batch never overtakes one the
// link refused. The batch stays pending until acked. Payload is marshalled
// here and capped by the control plane.
func (r *Reporter) Append(sessionID, kind string, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		r.logger.Warn("event payload could not be encoded", slog.String("kind", kind), slog.Any("error", err))
		return
	}
	n := r.seq.Add(1)
	ordinal := r.batches.Add(1)
	batch := EventsAppend{
		Type:      "events.append",
		BatchID:   fmt.Sprintf("%s-b%d", r.runID, ordinal),
		SessionID: sessionID,
		Events: []Event{{
			IdempotencyKey: fmt.Sprintf("%s:%d", r.runID, n),
			Kind:           kind,
			Payload:        string(body),
			OccurredAt:     r.now().UTC(),
		}},
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.pending) >= r.limit {
		r.dropOldestLocked()
	}
	r.pending = append(r.pending, &pendingBatch{batch: batch})
	r.flushLocked()
}

// Ack drops every key the control plane accounted for; a batch whose keys are
// all accounted for is forgotten. A rejected key is logged and dropped too —
// it was refused with a reason, and resending it would only be refused again.
func (r *Reporter) Ack(ack EventsAck) {
	r.mu.Lock()
	defer r.mu.Unlock()
	at := -1
	for i, entry := range r.pending {
		if entry.batch.BatchID == ack.BatchID {
			at = i
			break
		}
	}
	if at < 0 {
		return
	}
	settled := map[string]bool{}
	for _, key := range ack.Accepted {
		settled[key] = true
	}
	for _, rejected := range ack.Rejected {
		settled[rejected.IdempotencyKey] = true
		r.logger.Warn("event rejected by the control plane",
			slog.String("key", rejected.IdempotencyKey), slog.String("reason", rejected.Reason))
	}
	entry := r.pending[at]
	kept := make([]Event, 0, len(entry.batch.Events))
	for _, event := range entry.batch.Events {
		if !settled[event.IdempotencyKey] {
			kept = append(kept, event)
		}
	}
	if len(kept) == 0 {
		r.pending = append(r.pending[:at], r.pending[at+1:]...)
		return
	}
	entry.batch.Events = kept
}

// Resend replays every batch still waiting on an ack: what a reconnect calls
// after hello, because a WebSocket cannot tell "persisted" from "never arrived".
func (r *Reporter) Resend() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, entry := range r.pending {
		entry.queued = false
	}
	r.flushLocked()
}

// Retry sends what the link refused while it stayed up — a full control
// queue — without waiting for a reconnect. The daemon calls it on a ticker.
func (r *Reporter) Retry() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.flushLocked()
}

// Pending is how many batches await an ack, for status and tests.
func (r *Reporter) Pending() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.pending)
}

// Unsent is how many pending batches the link has not taken, for tests.
func (r *Reporter) Unsent() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	unsent := 0
	for _, entry := range r.pending {
		if !entry.queued {
			unsent++
		}
	}
	return unsent
}

// flushLocked hands the link every batch it has not taken yet, in the order
// they were made, and stops at the first refusal. Between links or with a
// full queue the rest would be refused too, and sending past a refused batch
// would put a newer one ahead of it. Retry, Resend or the next Append carries
// on from there.
func (r *Reporter) flushLocked() {
	for _, entry := range r.pending {
		if entry.queued {
			continue
		}
		if err := r.sender.Send(entry.batch); err != nil {
			r.logger.Debug("event batches held until the link takes them",
				slog.String("batch", entry.batch.BatchID), slog.Any("error", err))
			return
		}
		entry.queued = true
	}
}

func (r *Reporter) dropOldestLocked() {
	dropped := r.pending[0]
	r.pending[0] = nil
	r.pending = r.pending[1:]
	kinds := make([]string, 0, len(dropped.batch.Events))
	for _, event := range dropped.batch.Events {
		kinds = append(kinds, event.Kind)
	}
	r.logger.Warn("event batch dropped: too many wait on the link; the next hello reconciles",
		slog.String("batch", dropped.batch.BatchID), slog.String("session", dropped.batch.SessionID),
		slog.Any("kinds", kinds), slog.Int("limit", r.limit))
}

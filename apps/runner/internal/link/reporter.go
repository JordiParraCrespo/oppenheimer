package link

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// Sender is the slice of Client the reporter needs, so tests can stand in.
type Sender interface {
	Send(message any) error
}

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

	mu      sync.Mutex
	pending map[string]pendingBatch // batchId → batch, until fully acked
	batches atomic.Uint64
}

// pendingBatch is a batch awaiting its ack, with the order it was made in: a
// resend replays batches in that order, because a session's log is ordered by
// arrival and a start's `running` must not land after its `done`.
type pendingBatch struct {
	n     uint64
	batch EventsAppend
}

// NewReporter builds a reporter for one process.
func NewReporter(runID string, sender Sender, logger *slog.Logger) *Reporter {
	if logger == nil {
		logger = slog.Default()
	}
	return &Reporter{runID: runID, sender: sender, logger: logger, now: time.Now, pending: map[string]pendingBatch{}}
}

// RunID is the id every key starts with.
func (r *Reporter) RunID() string { return r.runID }

// Append records one event for a session and sends it in its own batch. The
// batch stays pending until acked; Resend replays what is still pending after
// a reconnect. Payload is marshalled here and capped by the control plane.
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
	r.pending[batch.BatchID] = pendingBatch{n: ordinal, batch: batch}
	r.mu.Unlock()
	r.send(batch)
}

// Ack drops every key the control plane accounted for; a batch whose keys are
// all accounted for is forgotten. A rejected key is logged and dropped too —
// it was refused with a reason, and resending it would only be refused again.
func (r *Reporter) Ack(ack EventsAck) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.pending[ack.BatchID]
	if !ok {
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
	batch := entry.batch
	kept := batch.Events[:0]
	for _, event := range batch.Events {
		if !settled[event.IdempotencyKey] {
			kept = append(kept, event)
		}
	}
	if len(kept) == 0 {
		delete(r.pending, ack.BatchID)
		return
	}
	batch.Events = kept
	r.pending[ack.BatchID] = pendingBatch{n: entry.n, batch: batch}
}

// Resend replays every batch still waiting on an ack: what a reconnect calls
// after hello, because a WebSocket cannot tell "persisted" from "never arrived".
func (r *Reporter) Resend() {
	r.mu.Lock()
	entries := make([]pendingBatch, 0, len(r.pending))
	for _, entry := range r.pending {
		entries = append(entries, entry)
	}
	r.mu.Unlock()
	// In the order they were made, never the map's: the control plane records
	// a link's batches as they arrive, and that is the log's order.
	sort.Slice(entries, func(i, j int) bool { return entries[i].n < entries[j].n })
	for _, entry := range entries {
		r.send(entry.batch)
	}
}

// Pending is how many batches await an ack, for status and tests.
func (r *Reporter) Pending() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.pending)
}

func (r *Reporter) send(batch EventsAppend) {
	if err := r.sender.Send(batch); err != nil {
		// Between links, or a full queue: the batch is pending and Resend
		// will carry it. Nothing is lost by not sending now.
		r.logger.Debug("event batch held until the link is back", slog.String("batch", batch.BatchID), slog.Any("error", err))
	}
}

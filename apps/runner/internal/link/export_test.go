package link

import "time"

// SetReporterLimit lowers a reporter's cap on pending batches, so a test need
// not make thousands.
func SetReporterLimit(r *Reporter, limit int) { r.limit = limit }

// SetReporterClock replaces a reporter's clock, so a test can move past the
// ack timeout without waiting for it.
func SetReporterClock(r *Reporter, now func() time.Time) { r.now = now }

// ReporterAckTimeout is the timeout after which a reporter resends a batch
// the link took and nobody acked.
func ReporterAckTimeout(r *Reporter) time.Duration { return r.ackTimeout }

// FitHello is the hello the client would send for h.
func FitHello(h Hello) (Hello, SnapshotFit, int) { return fitHello(h) }

// FitHeartbeat is the heartbeat the client would send for b.
func FitHeartbeat(b Heartbeat) (Heartbeat, SnapshotFit, int) { return fitHeartbeat(b) }

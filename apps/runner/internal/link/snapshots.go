package link

import (
	"encoding/json"
	"log/slog"
)

// The session list is the one part of a control frame that grows with the
// host: `hello` and `heartbeat` carry a snapshot of every live session, and
// a frame over MaxFrameBytes closes the link with 1009 — on every redial,
// since the next hello is the same. So the list is fitted to the frame before
// it is sent, in three steps, each giving up more than the one before:
//
//  1. full: every snapshot as the handler built it (about 210 bytes for a
//     session with one short-named window, so some 2,400 of those; nearer
//     900 with long window names and a login URL);
//  2. compact: every session still listed, each reduced to its id, agent,
//     state and age — what `hello`'s reconciliation reads is the id, and a
//     session left out of it is recorded stopped — with no windows and no
//     optional fields (under 190 bytes each, room for about 2,800);
//  3. truncated: as many compact snapshots as fit, in the handler's order,
//     logged as an error, because the control plane's reconciliation records
//     a session a hello leaves out as stopped. No host gets near it in
//     practice; the step exists so that one that does still has a link.

// SnapshotFit is how a session list was fitted to a frame.
type SnapshotFit int

const (
	// FitFull sent every snapshot as built.
	FitFull SnapshotFit = iota
	// FitCompact sent every session, each with only its required fields.
	FitCompact
	// FitTruncated sent only the compact snapshots that fit.
	FitTruncated
)

func (f SnapshotFit) String() string {
	switch f {
	case FitCompact:
		return "compact"
	case FitTruncated:
		return "truncated"
	default:
		return "full"
	}
}

// fitSessions returns sessions fitted to budget bytes of JSON array. A
// snapshot that does not marshal is left out, as it could not be sent anyway.
func fitSessions(sessions []SessionSnapshot, budget int) ([]SessionSnapshot, SnapshotFit) {
	if arrayBytes(sessions) <= budget {
		return sessions, FitFull
	}
	compact := make([]SessionSnapshot, len(sessions))
	for i, s := range sessions {
		compact[i] = SessionSnapshot{
			SessionID: s.SessionID, Agent: s.Agent, Observed: s.Observed,
			StateSeconds: s.StateSeconds, Windows: []Window{},
		}
	}
	if arrayBytes(compact) <= budget {
		return compact, FitCompact
	}
	used := len("[]")
	for i, s := range compact {
		size := elementBytes(s)
		if i > 0 {
			size++ // the comma before it
		}
		if used+size > budget {
			return compact[:i], FitTruncated
		}
		used += size
	}
	return compact, FitCompact
}

func arrayBytes(sessions []SessionSnapshot) int {
	body, err := json.Marshal(sessions)
	if err != nil {
		return len(sessions) * MaxFrameBytes // never fits; fitted element by element
	}
	return len(body)
}

func elementBytes(s SessionSnapshot) int {
	body, err := json.Marshal(s)
	if err != nil {
		return MaxFrameBytes
	}
	return len(body)
}

// sessionBudget is what is left of MaxFrameBytes for the session list once
// the rest of the message is encoded, with the list empty.
func sessionBudget(message any) int {
	body, err := json.Marshal(message)
	if err != nil {
		return 0
	}
	return MaxFrameBytes - len(body) + len("[]")
}

// fitHello fits a hello's session list to the frame; Type and Protocol are
// already set, so the budget counts them.
func fitHello(hello Hello) (Hello, SnapshotFit, int) {
	all := hello.Sessions
	hello.Sessions = []SessionSnapshot{}
	budget := sessionBudget(hello)
	fitted, fit := fitSessions(all, budget)
	hello.Sessions = fitted
	return hello, fit, len(all)
}

// fitHeartbeat is fitHello for a heartbeat.
func fitHeartbeat(beat Heartbeat) (Heartbeat, SnapshotFit, int) {
	all := beat.Sessions
	beat.Sessions = []SessionSnapshot{}
	budget := sessionBudget(beat)
	fitted, fit := fitSessions(all, budget)
	beat.Sessions = fitted
	return beat, fit, len(all)
}

// logHelloFit says what a hello's fitted list gave up, once per link.
func logHelloFit(logger *slog.Logger, fit SnapshotFit, sent, held int) {
	switch fit {
	case FitCompact:
		logger.Warn("hello: session list sent compact to fit the frame cap",
			slog.Int("sessions", held), slog.Int("limit", MaxFrameBytes))
	case FitTruncated:
		logger.Error("hello: session list truncated to fit the frame cap; the sessions left out are recorded stopped",
			slog.Int("sent", sent), slog.Int("sessions", held), slog.Int("limit", MaxFrameBytes))
	}
}

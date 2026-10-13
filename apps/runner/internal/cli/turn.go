package cli

import (
	"unicode/utf8"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// turnResultMaxBytes keeps a turn's answer well inside the 8 KB an event
// payload may carry (01), with room for the rest of the payload. The full
// answer stays in the agent's own transcript.
const turnResultMaxBytes = 4096

// turnModelMaxLength is `session_turn."model"`'s width. A longer id is dropped
// rather than cut: a truncated model id names a model that does not exist.
const turnModelMaxLength = 64

// TurnEnded logs the end of a headless turn: the wrapper's exit code and what
// the agent printed, read for its answer, cost, model and token usage. It is
// the publisher the headless drive calls when the agent process exits.
func (h *linkHandler) TurnEnded(sessionID string, exitCode int, output []byte) {
	if h.reporter == nil {
		return
	}
	h.reporter.Append(sessionID, link.TurnEndedKind, turnEndedPayload(exitCode, output))
}

// turnEndedPayload is Claude Code's headless output as `turn.ended` carries
// it. An agent that prints something else yields the exit code alone, and the
// control plane records the rest as not measured.
func turnEndedPayload(exitCode int, output []byte) link.TurnEndedPayload {
	r := sessionsdomain.ParseClaudeTurnResult(output)
	payload := link.TurnEndedPayload{
		ExitCode:          exitCode,
		AgentSessionID:    r.AgentSessionID,
		Result:            r.Result,
		CostUSD:           r.CostUSD,
		PermissionDenials: r.PermissionDenials,
		InputTokens:       r.InputTokens,
		OutputTokens:      r.OutputTokens,
		CacheReadTokens:   r.CacheReadTokens,
		CacheWriteTokens:  r.CacheWriteTokens,
	}
	if r.AgentSessionID != nil && len(*r.AgentSessionID) > 128 {
		payload.AgentSessionID = nil
	}
	if r.Model != nil && len(*r.Model) <= turnModelMaxLength {
		payload.Model = r.Model
	}
	if r.Result != nil && len(*r.Result) > turnResultMaxBytes {
		cut := truncateUTF8(*r.Result, turnResultMaxBytes)
		payload.Result = &cut
	}
	return payload
}

// truncateUTF8 cuts s to at most n bytes without splitting a character.
func truncateUTF8(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
}

package domain

import "time"

// agentInput is one agent's `input` entry of the catalog
// (`packages/shared/src/agents/catalog.ts`); the table is inputCatalog in
// launch_catalog.gen.go.
type agentInput struct {
	submit, stop  string
	pasteGapMs    int
	clear         string
	clearSettleMs int
	quit          []string
}

// Input is how a message is typed into an agent by something other than a
// person: Clear first when the agent has one, pasted, then Submit after
// PasteGap, so a CLI that would read an Enter arriving with the paste as part
// of it sends the message instead.
type Input struct {
	Submit   string
	Stop     string
	PasteGap time.Duration
	// Clear empties a prompt that may hold text nobody left there (ZCode's,
	// which recalls its last prompt on an Up arrow), so the message is not
	// sent joined to it; "" for an agent that needs none. ClearSettle is how
	// long the agent takes to act on it before the message may follow.
	Clear       string
	ClearSettle time.Duration
	// Quit is typed, each line then Submit, before the agent's terminal is
	// ended: what ends an agent whose work outlives its terminal (Hermes',
	// which runs at its gateway). None for the rest.
	Quit []string
}

// plainInput is the blank terminal's, and any agent the catalog has no
// input entry for: a line and Enter, as any shell takes it.
var plainInput = Input{Submit: "\r", Stop: "\x03"}

// Input is how a message is typed into this agent.
func (a Agent) Input() Input {
	in, ok := inputCatalog[a.CatalogID()]
	if !ok {
		return plainInput
	}
	return Input{
		Submit:      in.submit,
		Stop:        in.stop,
		PasteGap:    time.Duration(in.pasteGapMs) * time.Millisecond,
		Clear:       in.clear,
		ClearSettle: time.Duration(in.clearSettleMs) * time.Millisecond,
		Quit:        append([]string(nil), in.quit...),
	}
}

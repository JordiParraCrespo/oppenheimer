package domain

import "time"

// agentInput is one agent's `input` entry of the catalog
// (`packages/shared/src/agents/catalog.ts`); the table is inputCatalog in
// launch_catalog.gen.go.
type agentInput struct {
	submit, stop string
	pasteGapMs   int
}

// Input is how a message is typed into an agent by something other than a
// person: pasted, then Submit after PasteGap, so a CLI that would read an
// Enter arriving with the paste as part of it sends the message instead.
type Input struct {
	Submit   string
	Stop     string
	PasteGap time.Duration
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
	return Input{Submit: in.submit, Stop: in.stop, PasteGap: time.Duration(in.pasteGapMs) * time.Millisecond}
}

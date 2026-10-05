// Package link is the runner's end of the control-plane link: one outbound
// WebSocket, its reconnect ladder and epoch, the frame layout, and the event
// batches with their idempotency keys. It is transport, not a context
// (02-runner §3): what each message *does* to a session is decided by the
// composition root that wires a Handler, never here.
package link

import (
	"encoding/json"
	"regexp"
)

// The message vocabulary is not written here. Zod in
// `packages/shared/src/protocol/` is the source, and
// `packages/shared/protocol-schema/protocol.schema.json` is the contract;
// `protocol.gen.go` is generated from that artifact by
// `packages/shared/scripts/emit-link-protocol.cjs` (one struct per message,
// the type names, and the link's constants), and `protocol_test.go` decodes
// the TypeScript tests' samples strictly into it. This file holds only what
// is not wire shape.

// IsCommandID reports whether id is a UUID, which is all a command id is (01).
// The runner names files by command ids, so this is checked where the id
// arrives, before anything uses it.
func IsCommandID(id string) bool { return commandIDPattern.MatchString(id) }

var commandIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Envelope is what every control frame carries at minimum: the discriminator.
type Envelope struct {
	Type string `json:"type"`
}

// Message is one decoded control frame: its type and its raw JSON, decoded a
// second time by whoever handles that type.
type Message struct {
	Type string
	Raw  json.RawMessage
}

// Decode reads a message's body into a typed struct.
func (m Message) Decode(v any) error { return json.Unmarshal(m.Raw, v) }

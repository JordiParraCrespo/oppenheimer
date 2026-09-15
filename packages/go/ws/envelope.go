// Package ws is the WebSocket hub: authenticated connections subscribe to
// topics and receive the events bounded contexts publish on them.
//
// The wire format is one JSON envelope per message in both directions. A
// client sends `subscribe`/`unsubscribe`/`ping`; the server answers with
// `subscribed`/`unsubscribed`/`pong`/`error` carrying the same `id`, and
// pushes `event` messages for subscribed topics. Payload schemas belong to
// the context that publishes them.
package ws

import "encoding/json"

// Message types.
const (
	TypeHello        = "hello"
	TypeSubscribe    = "subscribe"
	TypeSubscribed   = "subscribed"
	TypeUnsubscribe  = "unsubscribe"
	TypeUnsubscribed = "unsubscribed"
	TypePing         = "ping"
	TypePong         = "pong"
	TypeEvent        = "event"
	TypeError        = "error"
)

// Envelope is the frame every message uses.
type Envelope struct {
	Type string `json:"type"`
	// ID correlates a client request with the server's answer.
	ID string `json:"id,omitempty"`
	// Topics is set on subscribe/unsubscribe and their acknowledgements.
	Topics []string `json:"topics,omitempty"`
	// Topic and Event describe a pushed event.
	Topic string `json:"topic,omitempty"`
	Event string `json:"event,omitempty"`
	// Payload is the event body, or the hello body.
	Payload json.RawMessage `json:"payload,omitempty"`
	// Error carries a rejection reason on `error` frames.
	Error *ErrorBody `json:"error,omitempty"`
}

// ErrorBody is a compact problem for the socket.
type ErrorBody struct {
	Code   string `json:"code"`
	Detail string `json:"detail,omitempty"`
}

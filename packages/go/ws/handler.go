package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Authorizer decides whether a principal may subscribe to a topic. Bounded
// contexts register their topic rules so the hub stays domain-agnostic.
type Authorizer func(ctx context.Context, p *auth.Principal, topic string) error

// Handler upgrades an authenticated request and serves its session. Auth
// middleware must run before it: an upgrade with no principal is refused.
func Handler(hub *Hub, problems *problem.Writer, logger *slog.Logger, authorize Authorizer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := auth.FromContext(r.Context())
		if p == nil {
			problems.Write(w, r, problem.ErrUnauthorized)
			return
		}
		sock, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			CompressionMode: websocket.CompressionContextTakeover,
		})
		if err != nil {
			// Accept already wrote the HTTP error.
			logger.DebugContext(r.Context(), "ws accept failed", slog.Any("error", err))
			return
		}
		sock.SetReadLimit(hub.opts.ReadLimit)

		c := newConn(hub, sock)
		if !hub.add(c) {
			c.close(websocket.StatusGoingAway, "server shutting down")
			return
		}
		defer hub.remove(c)

		// A WebSocket outlives the HTTP request scope. r.Context() is built
		// on the server BaseContext, which is the SIGTERM signal context, so
		// deriving from it would cancel this read loop at the same instant
		// hub.Close tries to send its going-away frame — the client would
		// then see an abnormal 1006 close instead of 1001. WithoutCancel
		// keeps the correlation id (and any other request values) for logs
		// while detaching that cancellation; the connection now ends only
		// when the peer disconnects or the hub closes it.
		ctx, cancel := context.WithCancel(context.WithoutCancel(r.Context()))
		defer cancel()
		go c.writeLoop(ctx)

		hello, _ := json.Marshal(map[string]any{"principal": p.ID, "scopes": p.Scopes.Strings()})
		c.reply(Envelope{Type: TypeHello, Payload: hello})

		logger.InfoContext(ctx, "ws connected",
			slog.String("principal", p.ID),
			slog.String("correlationId", problem.CorrelationID(ctx)),
		)
		defer logger.InfoContext(ctx, "ws disconnected", slog.String("principal", p.ID))

		for {
			var in Envelope
			if err := wsjson.Read(ctx, sock, &in); err != nil {
				status := websocket.CloseStatus(err)
				if status == websocket.StatusNormalClosure || status == websocket.StatusGoingAway || errors.Is(err, context.Canceled) {
					return
				}
				if status == -1 {
					// Not a close frame: a malformed message. Tell the client and stop.
					c.close(websocket.StatusInvalidFramePayloadData, "malformed envelope")
				}
				return
			}
			c.handle(ctx, p, in, authorize)
		}
	})
}

func (c *conn) handle(ctx context.Context, p *auth.Principal, in Envelope, authorize Authorizer) {
	switch in.Type {
	case TypePing:
		c.reply(Envelope{Type: TypePong, ID: in.ID})
	case TypeSubscribe:
		if len(in.Topics) == 0 {
			c.fail(in.ID, "RUNNER_001", "subscribe needs at least one topic")
			return
		}
		if len(c.topics)+len(in.Topics) > c.hub.opts.MaxTopics {
			c.fail(in.ID, "RUNNER_001", "too many subscriptions")
			return
		}
		for _, topic := range in.Topics {
			if authorize != nil {
				if err := authorize(ctx, p, topic); err != nil {
					pe := problem.From(err)
					c.fail(in.ID, pe.Code, pe.Detail)
					return
				}
			}
		}
		for _, topic := range in.Topics {
			c.hub.subscribe(c, topic)
		}
		c.reply(Envelope{Type: TypeSubscribed, ID: in.ID, Topics: in.Topics})
	case TypeUnsubscribe:
		for _, topic := range in.Topics {
			c.hub.unsubscribe(c, topic)
		}
		c.reply(Envelope{Type: TypeUnsubscribed, ID: in.ID, Topics: in.Topics})
	default:
		c.fail(in.ID, "RUNNER_001", "unknown message type "+in.Type)
	}
}

func (c *conn) reply(env Envelope) {
	frame, _ := json.Marshal(env)
	c.enqueue(frame)
}

func (c *conn) fail(id, code, detail string) {
	c.reply(Envelope{Type: TypeError, ID: id, Error: &ErrorBody{Code: code, Detail: detail}})
}

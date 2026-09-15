package ws

import (
	"context"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// conn is one client. The read loop runs on the handler's goroutine; a
// dedicated writer goroutine owns every write so frames never interleave.
type conn struct {
	ws     *websocket.Conn
	hub    *Hub
	send   chan []byte
	topics map[string]struct{}

	closeOnce sync.Once
	done      chan struct{}
}

func newConn(hub *Hub, ws *websocket.Conn) *conn {
	return &conn{
		ws:     ws,
		hub:    hub,
		send:   make(chan []byte, hub.opts.SendBuffer),
		topics: map[string]struct{}{},
		done:   make(chan struct{}),
	}
}

// enqueue queues a frame; a full queue means the client cannot keep up and
// is dropped rather than stalling the publisher.
func (c *conn) enqueue(frame []byte) {
	select {
	case c.send <- frame:
	case <-c.done:
	default:
		c.hub.logger.Warn("ws client too slow, closing")
		go c.close(websocket.StatusPolicyViolation, "slow consumer")
	}
}

// writeLoop drains the send queue and keeps the connection alive with
// pings until the connection is done.
func (c *conn) writeLoop(ctx context.Context) {
	ticker := time.NewTicker(c.hub.opts.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-ctx.Done():
			return
		case frame := <-c.send:
			wctx, cancel := context.WithTimeout(ctx, c.hub.opts.WriteTimeout)
			err := c.ws.Write(wctx, websocket.MessageText, frame)
			cancel()
			if err != nil {
				c.close(websocket.StatusAbnormalClosure, "write failed")
				return
			}
		case <-ticker.C:
			pctx, cancel := context.WithTimeout(ctx, c.hub.opts.WriteTimeout)
			err := c.ws.Ping(pctx)
			cancel()
			if err != nil {
				c.close(websocket.StatusAbnormalClosure, "ping failed")
				return
			}
		}
	}
}

func (c *conn) close(code websocket.StatusCode, reason string) {
	c.closeOnce.Do(func() {
		close(c.done)
		_ = c.ws.Close(code, reason)
	})
}

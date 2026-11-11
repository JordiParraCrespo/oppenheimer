package chrome

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/coder/websocket"
)

// cdpMaxMessage bounds one message from the browser: a screenshot is the
// largest thing asked for.
const cdpMaxMessage = 16 << 20

// cdp is one connection to a browser's DevTools endpoint: commands by id,
// each answered once, and the events the browser sends between them.
type cdp struct {
	conn    *websocket.Conn
	nextID  atomic.Int64
	onEvent func(session, method string, params json.RawMessage)

	mu      sync.Mutex
	waiting map[int64]chan cdpReply
	closed  error
}

type cdpReply struct {
	result json.RawMessage
	err    error
}

type cdpFrame struct {
	ID        int64           `json:"id,omitempty"`
	Method    string          `json:"method,omitempty"`
	Params    json.RawMessage `json:"params,omitempty"`
	SessionID string          `json:"sessionId,omitempty"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// dialCDP connects to the endpoint and starts reading. onEvent is called on
// the reading goroutine for every event; it must not call back into the
// connection and wait.
func dialCDP(ctx context.Context, endpoint string, onEvent func(session, method string, params json.RawMessage)) (*cdp, error) {
	conn, _, err := websocket.Dial(ctx, endpoint, nil) //nolint:bodyclose // the library closes the handshake's body
	if err != nil {
		return nil, err
	}
	conn.SetReadLimit(cdpMaxMessage)
	c := &cdp{conn: conn, onEvent: onEvent, waiting: map[int64]chan cdpReply{}}
	go c.read() //nolint:gosec // the reader lives as long as the browser, not the call that dialled
	return c, nil
}

func (c *cdp) read() {
	for {
		_, raw, err := c.conn.Read(context.Background())
		if err != nil {
			c.fail(fmt.Errorf("the browser's connection ended: %w", err))
			return
		}
		var frame cdpFrame
		if json.Unmarshal(raw, &frame) != nil {
			continue
		}
		if frame.ID == 0 {
			if c.onEvent != nil && frame.Method != "" {
				c.onEvent(frame.SessionID, frame.Method, frame.Params)
			}
			continue
		}
		c.mu.Lock()
		waiter := c.waiting[frame.ID]
		delete(c.waiting, frame.ID)
		c.mu.Unlock()
		if waiter == nil {
			continue
		}
		if frame.Error != nil {
			waiter <- cdpReply{err: errors.New(frame.Error.Message)}
		} else {
			waiter <- cdpReply{result: frame.Result}
		}
	}
}

func (c *cdp) fail(err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed != nil {
		return
	}
	c.closed = err
	for id, waiter := range c.waiting {
		waiter <- cdpReply{err: err}
		delete(c.waiting, id)
	}
}

// call sends one command, to the page session when session is set, and
// decodes its result into out when out is not nil.
func (c *cdp) call(ctx context.Context, session, method string, params, out any) error {
	frame := cdpFrame{ID: c.nextID.Add(1), Method: method, SessionID: session}
	if params != nil {
		raw, err := json.Marshal(params)
		if err != nil {
			return err
		}
		frame.Params = raw
	}
	body, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	waiter := make(chan cdpReply, 1)
	c.mu.Lock()
	if c.closed != nil {
		c.mu.Unlock()
		return c.closed
	}
	c.waiting[frame.ID] = waiter
	c.mu.Unlock()
	if err := c.conn.Write(ctx, websocket.MessageText, body); err != nil {
		c.mu.Lock()
		delete(c.waiting, frame.ID)
		c.mu.Unlock()
		return err
	}
	select {
	case reply := <-waiter:
		if reply.err != nil {
			return fmt.Errorf("%s: %w", method, reply.err)
		}
		if out == nil {
			return nil
		}
		return json.Unmarshal(reply.result, out)
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.waiting, frame.ID)
		c.mu.Unlock()
		return ctx.Err()
	}
}

func (c *cdp) close() {
	_ = c.conn.Close(websocket.StatusNormalClosure, "")
	c.fail(errors.New("the browser was closed"))
}

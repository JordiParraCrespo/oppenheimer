package chrome

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
)

// cdpMaxMessage bounds one message from the browser: a screenshot is the
// largest thing asked for.
const cdpMaxMessage = 16 << 20

// cdp is the DevTools protocol over the two pipes a browser started with
// --remote-debugging-pipe holds: commands by id, each answered once, and the
// events the browser sends between them, every message ending in a NUL. A
// pipe has no address, so nothing else on the host can reach the browser.
type cdp struct {
	in      io.WriteCloser
	out     io.ReadCloser
	writeMu sync.Mutex
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

// newCDP speaks over the pipes and starts reading. onEvent is called on the
// reading goroutine for every event; it must not call back into the
// connection and wait.
func newCDP(in io.WriteCloser, out io.ReadCloser, onEvent func(session, method string, params json.RawMessage)) *cdp {
	c := &cdp{in: in, out: out, onEvent: onEvent, waiting: map[int64]chan cdpReply{}}
	go c.read() //nolint:gosec // the reader lives as long as the browser, not the call that started it
	return c
}

func (c *cdp) read() {
	reader := bufio.NewReaderSize(c.out, 64<<10)
	for {
		raw, err := readMessage(reader)
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
	c.writeMu.Lock()
	_, err = c.in.Write(append(body, 0))
	c.writeMu.Unlock()
	if err != nil {
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
	_ = c.in.Close()
	_ = c.out.Close()
	c.fail(errors.New("the browser was closed"))
}

// readMessage is the next message, without its NUL.
func readMessage(reader *bufio.Reader) ([]byte, error) {
	var message []byte
	for {
		part, err := reader.ReadSlice(0)
		message = append(message, part...)
		if len(message) > cdpMaxMessage {
			return nil, errors.New("a message over the largest the browser is asked for")
		}
		if errors.Is(err, bufio.ErrBufferFull) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return message[:len(message)-1], nil
	}
}

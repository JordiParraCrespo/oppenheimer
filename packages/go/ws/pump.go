package ws

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/coder/websocket"
)

// Frame is one message to write.
type Frame struct {
	Binary bool
	Data   []byte
}

// Source is where a pump's frames come from. Next never blocks. It returns
// either the next frame with a nil ready channel; or no frame and a ready
// channel that closes when there may be one; or an error once the source is
// closed, which the pump returns as it is.
type Source interface {
	Next() (frame Frame, ready <-chan struct{}, err error)
}

// PumpOptions bound a pump's writes and pings.
type PumpOptions struct {
	// PingInterval is how often a ping is written; zero writes none.
	PingInterval time.Duration
	// PingTimeout bounds a ping: it waits for its pong, so on a dead peer
	// this is what ends the pump.
	PingTimeout time.Duration
	// WriteTimeout bounds one frame's write.
	WriteTimeout time.Duration
}

// ErrWrite and ErrPing say which of a pump's writes failed; the error a pump
// returns wraps one of them and the socket's own error, reading "write: …"
// or "ping: …".
var (
	ErrWrite = errors.New("write")
	ErrPing  = errors.New("ping")
)

// Pump is the one goroutine that writes to conn: frames from src in the order
// src gives them, and a ping every PingInterval. A busy socket still pings: a
// tick that fired while frames were waiting is served between two of them.
// It returns the first write or ping error, src's error, or ctx's.
func Pump(ctx context.Context, conn *websocket.Conn, src Source, opts PumpOptions) error {
	return pump(ctx, conn, &sourceAdapter{src: src}, opts)
}

// PumpChan is Pump over a channel of text frames, for a writer fed by
// publishers that enqueue on a bounded channel (a Source's ready channel
// cannot be had from a plain channel without a goroutine per socket). It
// returns nil once done closes or frames is closed, and otherwise what Pump
// returns.
func PumpChan(ctx context.Context, conn *websocket.Conn, frames <-chan []byte, done <-chan struct{}, opts PumpOptions) error {
	err := pump(ctx, conn, chanSource{frames: frames, done: done}, opts)
	if errors.Is(err, errStopped) {
		return nil
	}
	return err
}

// source is what the one loop reads from: a frame now if there is one, and
// otherwise a wait for a frame, the ping tick or ctx.
type source interface {
	poll() (frame Frame, ok bool, err error)
	wait(ctx context.Context, tick <-chan time.Time) (frame Frame, ok, ticked bool, err error)
}

func pump(ctx context.Context, conn *websocket.Conn, src source, opts PumpOptions) error {
	var tick <-chan time.Time
	if opts.PingInterval > 0 {
		ticker := time.NewTicker(opts.PingInterval)
		defer ticker.Stop()
		tick = ticker.C
	}
	// A write or ping that ctx cuts short closes the socket, and the library
	// can report that close ("use of closed network connection") rather than
	// ctx's error; when ctx is done, that is the error to return.
	failed := func(kind, err error) error {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ctxErr
		}
		return fmt.Errorf("%w: %w", kind, err)
	}
	ping := func() error {
		pingCtx, cancel := context.WithTimeout(ctx, opts.PingTimeout)
		defer cancel()
		if err := conn.Ping(pingCtx); err != nil {
			return failed(ErrPing, err)
		}
		return nil
	}
	for {
		// A busy source never waits, so this is where it sees ctx end.
		if err := ctx.Err(); err != nil {
			return err
		}
		frame, ok, err := src.poll()
		if err != nil {
			return err
		}
		if !ok {
			var ticked bool
			frame, ok, ticked, err = src.wait(ctx, tick)
			switch {
			case err != nil:
				return err
			case ticked:
				if err := ping(); err != nil {
					return err
				}
				continue
			case !ok:
				continue
			}
		}
		// A busy socket still pings: a tick that fired while frames were
		// waiting is served between two of them.
		select {
		case <-tick:
			if err := ping(); err != nil {
				return err
			}
		default:
		}
		kind := websocket.MessageText
		if frame.Binary {
			kind = websocket.MessageBinary
		}
		writeCtx, cancel := context.WithTimeout(ctx, opts.WriteTimeout)
		err = conn.Write(writeCtx, kind, frame.Data)
		cancel()
		if err != nil {
			return failed(ErrWrite, err)
		}
	}
}

// sourceAdapter keeps the ready channel a Source handed out with no frame,
// for the wait that follows.
type sourceAdapter struct {
	src   Source
	ready <-chan struct{}
}

func (a *sourceAdapter) poll() (Frame, bool, error) {
	frame, ready, err := a.src.Next()
	if err != nil {
		return Frame{}, false, err
	}
	a.ready = ready
	return frame, ready == nil, nil
}

func (a *sourceAdapter) wait(ctx context.Context, tick <-chan time.Time) (Frame, bool, bool, error) {
	select {
	case <-ctx.Done():
		return Frame{}, false, false, ctx.Err()
	case <-a.ready:
		return Frame{}, false, false, nil
	case <-tick:
		return Frame{}, false, true, nil
	}
}

// errStopped is a channel source's end: done closed, or the channel did.
var errStopped = errors.New("ws: pump source stopped")

type chanSource struct {
	frames <-chan []byte
	done   <-chan struct{}
}

func (c chanSource) poll() (Frame, bool, error) {
	select {
	case <-c.done:
		return Frame{}, false, errStopped
	case data, open := <-c.frames:
		if !open {
			return Frame{}, false, errStopped
		}
		return Frame{Data: data}, true, nil
	default:
		return Frame{}, false, nil
	}
}

func (c chanSource) wait(ctx context.Context, tick <-chan time.Time) (Frame, bool, bool, error) {
	select {
	case <-c.done:
		return Frame{}, false, false, errStopped
	case <-ctx.Done():
		return Frame{}, false, false, ctx.Err()
	case data, open := <-c.frames:
		if !open {
			return Frame{}, false, false, errStopped
		}
		return Frame{Data: data}, true, false, nil
	case <-tick:
		return Frame{}, false, true, nil
	}
}

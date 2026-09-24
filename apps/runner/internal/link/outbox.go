package link

import (
	"context"
	"errors"
	"sync"
)

// controlQueue bounds the control frames a link can hold. Control frames are
// small and rare (heartbeats, event batches, replies), so a full queue means
// the link is not moving at all.
const controlQueue = 1024

// attachmentQueue bounds the PTY frames one attachment can have waiting. The
// credit window bounds its bytes; this bounds its count, since a pane that
// prints one byte at a time would otherwise queue a frame per byte.
const attachmentQueue = 64

// errOutboxClosed is what a producer gets once the link it was writing to is
// gone.
var errOutboxClosed = errors.New("link: outbox closed")

// outbox is what the one writer drains, in the order that keeps a terminal
// responsive: every control frame first, then one PTY frame per attachment in
// turn. A single FIFO would put a keystroke's echo behind another pane's build
// log; round-robin bounds that wait to one frame per busy attachment.
//
// PTY frames are never dropped: a producer blocks while its attachment's queue
// is full, which stalls that pane's reads and nothing else. Dropping would cut
// an escape sequence in half and leak the bytes from the credit window.
type outbox struct {
	mu      sync.Mutex
	control [][]byte
	queues  map[uint32][][]byte
	ring    []uint32 // attachments with frames waiting, in turn order
	closed  bool
	// ready wakes the writer; space wakes producers. Both are broadcast by
	// closing and replacing, so any number of waiters wake at once.
	ready chan struct{}
	space chan struct{}
}

func newOutbox() *outbox {
	return &outbox{
		queues: make(map[uint32][][]byte),
		ready:  make(chan struct{}),
		space:  make(chan struct{}),
	}
}

// pushControl queues a control frame, or answers ErrBackpressure when the
// queue is full. It never blocks: a heartbeat must not wait behind itself.
func (o *outbox) pushControl(frame []byte) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.closed {
		return errOutboxClosed
	}
	if len(o.control) >= controlQueue {
		return ErrBackpressure
	}
	o.control = append(o.control, frame)
	o.wakeWriterLocked()
	return nil
}

// pushFrame queues a PTY frame for an attachment, blocking while that
// attachment's queue is full until there is room, the outbox closes or ctx
// ends.
func (o *outbox) pushFrame(ctx context.Context, id uint32, frame []byte) error {
	for {
		o.mu.Lock()
		if o.closed {
			o.mu.Unlock()
			return errOutboxClosed
		}
		queue := o.queues[id]
		if len(queue) < attachmentQueue {
			if len(queue) == 0 {
				o.ring = append(o.ring, id)
			}
			o.queues[id] = append(queue, frame)
			o.wakeWriterLocked()
			o.mu.Unlock()
			return nil
		}
		space := o.space
		o.mu.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-space:
		}
	}
}

// poll returns the next frame without blocking: control first, then the
// attachment whose turn it is. With nothing waiting it returns a nil frame and
// a channel that closes when there may be one, so the writer can select on it
// alongside its ping ticker.
func (o *outbox) poll() ([]byte, <-chan struct{}, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if frame, ok := o.popLocked(); ok {
		return frame, nil, nil
	}
	if o.closed {
		return nil, nil, errOutboxClosed
	}
	return nil, o.ready, nil
}

// next blocks until a frame is waiting and returns it.
func (o *outbox) next(ctx context.Context) ([]byte, error) {
	for {
		frame, ready, err := o.poll()
		if frame != nil || err != nil {
			return frame, err
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ready:
		}
	}
}

func (o *outbox) popLocked() ([]byte, bool) {
	if len(o.control) > 0 {
		frame := o.control[0]
		o.control[0] = nil
		o.control = o.control[1:]
		return frame, true
	}
	if len(o.ring) == 0 {
		return nil, false
	}
	id := o.ring[0]
	o.ring = o.ring[1:]
	queue := o.queues[id]
	frame := queue[0]
	queue[0] = nil
	if rest := queue[1:]; len(rest) > 0 {
		o.queues[id] = rest
		// Still has frames: back of the line, behind everyone else's turn.
		o.ring = append(o.ring, id)
	} else {
		delete(o.queues, id)
	}
	if len(queue) == attachmentQueue {
		o.wakeProducersLocked()
	}
	return frame, true
}

// close wakes everyone; producers and the writer see errOutboxClosed.
func (o *outbox) close() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.closed {
		return
	}
	o.closed = true
	o.wakeWriterLocked()
	o.wakeProducersLocked()
}

func (o *outbox) wakeWriterLocked() {
	close(o.ready)
	o.ready = make(chan struct{})
}

func (o *outbox) wakeProducersLocked() {
	close(o.space)
	o.space = make(chan struct{})
}

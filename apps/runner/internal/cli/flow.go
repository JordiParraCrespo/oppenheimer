package cli

import (
	"context"
	"sync"
)

// creditWindow is 01's 256 KB: the bytes an attachment may have in flight
// before its PTY reads pause. A runaway build stalls its own pane, never the
// link.
const creditWindow = 256 * 1024

// flowWindow is one attachment's credit: bytes sent minus bytes the browser
// acknowledged consuming. A pump acquires before every read and blocks while
// the window is spent; a credit or a close wakes it.
type flowWindow struct {
	mu       sync.Mutex
	cond     *sync.Cond
	inFlight int
	closed   bool
}

func newFlowWindow() *flowWindow {
	w := &flowWindow{}
	w.cond = sync.NewCond(&w.mu)
	return w
}

// acquire blocks until at least one byte of window is free, or the
// attachment closes or ctx ends. It answers false when there is nothing
// left to read for.
func (w *flowWindow) acquire(ctx context.Context) bool {
	stop := context.AfterFunc(ctx, func() {
		w.mu.Lock()
		w.cond.Broadcast()
		w.mu.Unlock()
	})
	defer stop()
	w.mu.Lock()
	defer w.mu.Unlock()
	for w.inFlight >= creditWindow && !w.closed && ctx.Err() == nil {
		w.cond.Wait()
	}
	return !w.closed && ctx.Err() == nil
}

// sent records bytes queued for the browser.
func (w *flowWindow) sent(n int) {
	w.mu.Lock()
	w.inFlight += n
	w.mu.Unlock()
}

// credit records bytes the browser consumed.
func (w *flowWindow) credit(n int) {
	w.mu.Lock()
	w.inFlight -= n
	if w.inFlight < 0 {
		w.inFlight = 0
	}
	w.cond.Broadcast()
	w.mu.Unlock()
}

func (w *flowWindow) close() {
	w.mu.Lock()
	w.closed = true
	w.cond.Broadcast()
	w.mu.Unlock()
}

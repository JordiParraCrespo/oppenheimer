package cli

import (
	"sync"
	"time"
)

// lanes runs work off the link's read loop, one queue per session: commands
// for one session run one at a time in the order they arrived, commands for
// different sessions side by side.
//
// A create is the first command in its session's lane, so an attach, input
// or stop sent right after it waits for the session instead of finding none,
// and a create the control plane redelivers after a reconnect runs once the
// first has ended — finding the session it made, or taking over what it left.
// The read loop itself never waits: pongs and the `credentials.grant` a
// private clone is waiting on arrive on it.
//
// Unpairing closes them: nothing queued after that runs, and the host waits
// for what is running to return before it stops its sessions, so a create
// cannot start a tmux session behind the stop.
type lanes struct {
	mu sync.Mutex
	// closed drops work arriving after the host was unpaired.
	closed bool
	// running counts the lanes with a goroutine draining them.
	running sync.WaitGroup
	// queues holds the waiting work of each busy lane. A key is present
	// exactly while its lane has a goroutine draining it.
	queues map[string][]func()
}

func newLanes() *lanes { return &lanes{queues: map[string][]func(){}} }

// run queues job on key's lane, starting the lane if it is idle.
func (l *lanes) run(key string, job func()) {
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		return
	}
	if queue, busy := l.queues[key]; busy {
		l.queues[key] = append(queue, job)
		l.mu.Unlock()
		return
	}
	l.queues[key] = nil
	l.running.Add(1)
	l.mu.Unlock()
	go l.drain(key, job)
}

// close drops everything queued and anything that arrives later, then waits
// up to timeout for the jobs already running to return. It reports whether
// they all did.
func (l *lanes) close(timeout time.Duration) bool {
	l.mu.Lock()
	l.closed = true
	for key := range l.queues {
		l.queues[key] = nil
	}
	l.mu.Unlock()
	done := make(chan struct{})
	go func() {
		l.running.Wait()
		close(done)
	}()
	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}

// drain runs job and then everything queued behind it. The key goes only
// under the lock and only once the queue is empty, so work arriving while the
// lane winds down queues behind the rest rather than overtaking it. A job
// that fails is still just a job that returned: the lane goes on.
func (l *lanes) drain(key string, job func()) {
	defer l.running.Done()
	for {
		job()
		l.mu.Lock()
		queue := l.queues[key]
		if len(queue) == 0 {
			delete(l.queues, key)
			l.mu.Unlock()
			return
		}
		job, l.queues[key] = queue[0], queue[1:]
		l.mu.Unlock()
	}
}

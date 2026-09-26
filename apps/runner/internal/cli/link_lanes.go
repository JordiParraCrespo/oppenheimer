package cli

import "sync"

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
type lanes struct {
	mu sync.Mutex
	// queues holds the waiting work of each busy lane. A key is present
	// exactly while its lane has a goroutine draining it.
	queues map[string][]func()
}

func newLanes() *lanes { return &lanes{queues: map[string][]func(){}} }

// run queues job on key's lane, starting the lane if it is idle.
func (l *lanes) run(key string, job func()) {
	l.mu.Lock()
	if queue, busy := l.queues[key]; busy {
		l.queues[key] = append(queue, job)
		l.mu.Unlock()
		return
	}
	l.queues[key] = nil
	l.mu.Unlock()
	go l.drain(key, job)
}

// drain runs job and then everything queued behind it. The key goes only
// under the lock and only once the queue is empty, so work arriving while the
// lane winds down queues behind the rest rather than overtaking it. A job
// that fails is still just a job that returned: the lane goes on.
func (l *lanes) drain(key string, job func()) {
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

package cli

import (
	"sync"
	"sync/atomic"
)

// updateGate is what the link tells the update loop: whether this process
// ever linked, and how often the control plane refused its hello. Uptime
// alone passed 0.1.24, which stayed up for its five minutes while every hello
// it sent was refused, and the host stayed offline on a "healthy" update.
type updateGate struct {
	once     sync.Once
	linkOnce sync.Once
	linked   chan struct{}
	refused  chan struct{}
	refusals atomic.Int32
}

// helloRefusalsToRollBack is how many refusals, with no link in between,
// prove a pending update cannot link. A control plane mid-deploy refuses a
// dial or two; one that refuses this many in a row refuses this binary.
const helloRefusalsToRollBack = 5

func (g *updateGate) init() {
	g.once.Do(func() {
		g.linked = make(chan struct{})
		g.refused = make(chan struct{}, 1)
	})
}

// noteLinked records a link that came up. Idempotent.
func (g *updateGate) noteLinked() {
	g.init()
	g.refusals.Store(0)
	g.linkOnce.Do(func() { close(g.linked) })
}

// noteRefused counts a hello the control plane refused.
func (g *updateGate) noteRefused() {
	g.init()
	g.refusals.Add(1)
	select {
	case g.refused <- struct{}{}:
	default:
	}
}

// linkedC is closed once a link has come up.
func (g *updateGate) linkedC() <-chan struct{} { g.init(); return g.linked }

// refusedC wakes after a refusal.
func (g *updateGate) refusedC() <-chan struct{} { g.init(); return g.refused }

// refusedEnough reports a run of refusals long enough to roll back on.
func (g *updateGate) refusedEnough() bool { return g.refusals.Load() >= helloRefusalsToRollBack }

package main

import (
	"container/heap"
	"log/slog"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// Router moves IP packets between the nodes' TUN devices, each one when the
// model says it arrives. Node 0 is the relay's side, the root namespace; a
// packet's destination node is read off its IPv4 header, its source is the
// device it came from.
type Router struct {
	model  *Model
	tuns   []int
	byAddr map[[4]byte]int
	queue  chan *packet
	logger *slog.Logger

	mu    sync.Mutex
	stats map[[2]int]*LegStats
}

// LegStats is what one directed leg carried.
type LegStats struct {
	Packets int64 `json:"packets"`
	Bytes   int64 `json:"bytes"`
	Dropped int64 `json:"dropped"`
}

type packet struct {
	at   time.Time
	seq  uint64
	dst  int
	data []byte
}

func newRouter(model *Model, tuns []int, addrs [][4]byte, logger *slog.Logger) *Router {
	r := &Router{
		model:  model,
		tuns:   tuns,
		byAddr: map[[4]byte]int{},
		queue:  make(chan *packet, 4096),
		logger: logger,
		stats:  map[[2]int]*LegStats{},
	}
	for i, a := range addrs {
		r.byAddr[a] = i
	}
	return r
}

func (r *Router) run() {
	for src := range r.tuns {
		go r.read(src)
	}
	go r.deliver()
}

func (r *Router) read(src int) {
	buf := make([]byte, 65536)
	for {
		n, err := unix.Read(r.tuns[src], buf)
		if err != nil {
			if err == unix.EINTR {
				continue
			}
			return
		}
		// IPv4 only: the nodes have no other addresses worth routing.
		if n < 20 || buf[0]>>4 != 4 {
			continue
		}
		var addr [4]byte
		copy(addr[:], buf[16:20])
		dst, ok := r.byAddr[addr]
		if !ok || dst == src {
			continue
		}
		at, ok := r.model.Schedule(time.Now(), src, dst, n)
		r.count(src, dst, n, ok)
		if !ok {
			continue
		}
		r.queue <- &packet{at: at, dst: dst, data: append([]byte(nil), buf[:n]...)}
	}
}

func (r *Router) count(src, dst, n int, delivered bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := r.stats[[2]int{src, dst}]
	if s == nil {
		s = &LegStats{}
		r.stats[[2]int{src, dst}] = s
	}
	if !delivered {
		s.Dropped++
		return
	}
	s.Packets++
	s.Bytes += int64(n)
}

// Stats is every leg's counts so far, keyed by node index.
func (r *Router) Stats() map[[2]int]LegStats {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make(map[[2]int]LegStats, len(r.stats))
	for k, v := range r.stats {
		out[k] = *v
	}
	return out
}

// ResetStats starts the counts again.
func (r *Router) ResetStats() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stats = map[[2]int]*LegStats{}
}

// deliver writes each packet to its destination at its time, earliest first.
func (r *Router) deliver() {
	var pending packetHeap
	var seq uint64
	timer := time.NewTimer(time.Hour)
	for {
		if len(pending) > 0 {
			timer.Reset(time.Until(pending[0].at))
		}
		select {
		case p := <-r.queue:
			seq++
			p.seq = seq
			heap.Push(&pending, p)
		case <-timer.C:
		}
		now := time.Now()
		for len(pending) > 0 && !pending[0].at.After(now) {
			p := heap.Pop(&pending).(*packet)
			if _, err := unix.Write(r.tuns[p.dst], p.data); err != nil {
				r.logger.Debug("write", slog.Int("node", p.dst), slog.Any("error", err))
			}
		}
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
	}
}

type packetHeap []*packet

func (h packetHeap) Len() int { return len(h) }
func (h packetHeap) Less(i, j int) bool {
	if h[i].at.Equal(h[j].at) {
		return h[i].seq < h[j].seq
	}
	return h[i].at.Before(h[j].at)
}
func (h packetHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *packetHeap) Push(x any)   { *h = append(*h, x.(*packet)) }
func (h *packetHeap) Pop() any {
	old := *h
	p := old[len(old)-1]
	*h = old[:len(old)-1]
	return p
}

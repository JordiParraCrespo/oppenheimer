package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Hub fans events out to subscribed connections. One hub serves every
// context; topics keep their streams apart.
type Hub struct {
	logger *slog.Logger
	opts   Options

	mu     sync.RWMutex
	conns  map[*conn]struct{}
	topics map[string]map[*conn]struct{}
	closed bool
}

// Options bound the resources a connection may consume.
type Options struct {
	// SendBuffer is how many pending frames a connection may have before it
	// is considered too slow and closed. Dropping a client beats blocking a
	// publisher.
	SendBuffer int
	// WriteTimeout bounds a single frame write.
	WriteTimeout time.Duration
	// PingInterval keeps NATs and proxies from idling the socket out.
	PingInterval time.Duration
	// ReadLimit caps an inbound frame in bytes.
	ReadLimit int64
	// MaxTopics caps subscriptions per connection.
	MaxTopics int
}

// DefaultOptions are safe for a service-to-service stream.
func DefaultOptions() Options {
	return Options{
		SendBuffer:   64,
		WriteTimeout: 5 * time.Second,
		PingInterval: 30 * time.Second,
		ReadLimit:    32 << 10,
		MaxTopics:    128,
	}
}

// NewHub builds an empty hub.
func NewHub(logger *slog.Logger, opts Options) *Hub {
	return &Hub{
		logger: logger,
		opts:   opts,
		conns:  map[*conn]struct{}{},
		topics: map[string]map[*conn]struct{}{},
	}
}

// Publish pushes an event to every connection subscribed to topic. It never
// blocks on a slow client: the frame is marshalled once and queued, and a
// connection whose queue is full is closed.
func (h *Hub) Publish(topic, event string, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		h.logger.Error("ws payload not marshallable", slog.String("topic", topic), slog.Any("error", err))
		return
	}
	frame, _ := json.Marshal(Envelope{Type: TypeEvent, Topic: topic, Event: event, Payload: body})

	h.mu.RLock()
	subs := make([]*conn, 0, len(h.topics[topic]))
	for c := range h.topics[topic] {
		subs = append(subs, c)
	}
	h.mu.RUnlock()

	for _, c := range subs {
		c.enqueue(frame)
	}
}

// Len is the number of live connections, for health and metrics.
func (h *Hub) Len() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns)
}

// Close tells every client the server is going away and waits for the
// writers to drain, bounded by ctx. Serve calls it during shutdown.
func (h *Hub) Close(ctx context.Context) {
	h.mu.Lock()
	h.closed = true
	conns := make([]*conn, 0, len(h.conns))
	for c := range h.conns {
		conns = append(conns, c)
	}
	// Forget them now so publishers stop queueing frames and Len reports
	// the truth while the close handshakes are in flight.
	h.conns = map[*conn]struct{}{}
	h.topics = map[string]map[*conn]struct{}{}
	h.mu.Unlock()

	var wg sync.WaitGroup
	for _, c := range conns {
		wg.Add(1)
		go func(c *conn) {
			defer wg.Done()
			c.close(websocket.StatusGoingAway, "server shutting down")
		}(c)
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

func (h *Hub) add(c *conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return false
	}
	h.conns[c] = struct{}{}
	return true
}

func (h *Hub) remove(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns, c)
	for topic := range c.topics {
		h.unsubscribeLocked(c, topic)
	}
}

func (h *Hub) subscribe(c *conn, topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	set, ok := h.topics[topic]
	if !ok {
		set = map[*conn]struct{}{}
		h.topics[topic] = set
	}
	set[c] = struct{}{}
	c.topics[topic] = struct{}{}
}

func (h *Hub) unsubscribe(c *conn, topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.unsubscribeLocked(c, topic)
}

func (h *Hub) unsubscribeLocked(c *conn, topic string) {
	delete(c.topics, topic)
	if set, ok := h.topics[topic]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.topics, topic)
		}
	}
}

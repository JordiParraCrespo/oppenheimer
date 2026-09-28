package ws

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type message struct {
	kind websocket.MessageType
	data string
}

// peer is the far end of a pumped socket: it counts the pings it answers and
// hands over what it reads, or, when read is false, reads nothing at all, so
// no ping is ever answered.
type peer struct {
	pings    atomic.Int32
	messages chan message
}

// dial starts a peer and returns the pumping side's socket, with its reader
// running so a pong can arrive.
func dial(t *testing.T, read bool) (*websocket.Conn, *peer) {
	t.Helper()
	p := &peer{messages: make(chan message, 1024)}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OnPingReceived: func(context.Context, []byte) bool {
				p.pings.Add(1)
				return true
			},
		})
		if err != nil {
			return
		}
		defer c.CloseNow()
		if !read {
			<-r.Context().Done()
			return
		}
		for {
			kind, data, err := c.Read(r.Context())
			if err != nil {
				return
			}
			select {
			case p.messages <- message{kind, string(data)}:
			default:
			}
		}
	}))
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.CloseNow() })
	c.CloseRead(context.Background())
	return c, p
}

// listSource hands out its frames, then waits forever.
type listSource struct {
	mu     sync.Mutex
	frames []Frame
	never  chan struct{}
}

func (s *listSource) Next() (Frame, <-chan struct{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.frames) == 0 {
		return Frame{}, s.never, nil
	}
	frame := s.frames[0]
	s.frames = s.frames[1:]
	return frame, nil, nil
}

// busySource always has a frame waiting.
type busySource struct{}

func (busySource) Next() (Frame, <-chan struct{}, error) {
	return Frame{Data: []byte("x")}, nil, nil
}

func pumpOptions(ping time.Duration) PumpOptions {
	return PumpOptions{PingInterval: ping, PingTimeout: time.Second, WriteTimeout: time.Second}
}

func TestPumpWritesFramesInOrderWithTheirKind(t *testing.T) {
	conn, p := dial(t, true)
	src := &listSource{never: make(chan struct{}), frames: []Frame{
		{Data: []byte("first")},
		{Binary: true, Data: []byte{0, 1, 2}},
		{Data: []byte("third")},
	}}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- Pump(ctx, conn, src, pumpOptions(time.Hour)) }()

	want := []message{
		{websocket.MessageText, "first"},
		{websocket.MessageBinary, "\x00\x01\x02"},
		{websocket.MessageText, "third"},
	}
	for i, w := range want {
		select {
		case got := <-p.messages:
			if got != w {
				t.Fatalf("message %d = %+v, want %+v", i, got, w)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("message %d never arrived", i)
		}
	}
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("Pump = %v, want ctx's error", err)
	}
}

func TestPumpPingsBetweenFramesOnABusySocket(t *testing.T) {
	conn, p := dial(t, true)
	ctx, cancel := context.WithTimeout(context.Background(), 400*time.Millisecond)
	defer cancel()
	err := Pump(ctx, conn, busySource{}, pumpOptions(20*time.Millisecond))
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Pump = %v, want ctx's error", err)
	}
	if n := p.pings.Load(); n < 3 {
		t.Fatalf("%d pings on a socket that never ran out of frames, want several", n)
	}
}

// A ping still waiting for its pong when ctx ends is ctx's error, not a
// ping failure: the socket the library closes on the way out is not news.
func TestPumpReturnsCtxErrorWhenCancelledDuringAPing(t *testing.T) {
	conn, _ := dial(t, false)
	opts := PumpOptions{PingInterval: 10 * time.Millisecond, PingTimeout: 5 * time.Second, WriteTimeout: time.Second}
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(100*time.Millisecond, cancel)
	err := Pump(ctx, conn, &listSource{never: make(chan struct{})}, opts)
	if err != context.Canceled {
		t.Fatalf("Pump = %v, want exactly context.Canceled", err)
	}
}

// A busy source never waits, so ctx ending must still be seen between
// writes, and a write it cut short must not read as a write failure.
func TestPumpReturnsCtxErrorOnABusySocket(t *testing.T) {
	conn, _ := dial(t, true)
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(50*time.Millisecond, cancel)
	err := Pump(ctx, conn, busySource{}, pumpOptions(time.Hour))
	if err != context.Canceled {
		t.Fatalf("Pump = %v, want exactly context.Canceled", err)
	}
}

func TestPumpEndsWhenAPingGoesUnanswered(t *testing.T) {
	conn, _ := dial(t, false)
	opts := PumpOptions{PingInterval: 20 * time.Millisecond, PingTimeout: 100 * time.Millisecond, WriteTimeout: time.Second}
	src := &listSource{never: make(chan struct{})}
	done := make(chan error, 1)
	go func() { done <- Pump(context.Background(), conn, src, opts) }()
	select {
	case err := <-done:
		if !errors.Is(err, ErrPing) || !strings.HasPrefix(err.Error(), "ping: ") {
			t.Fatalf("Pump = %v, want a ping failure", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Pump kept going on a peer that answers no ping")
	}
}

func TestPumpReturnsTheSourcesError(t *testing.T) {
	conn, _ := dial(t, true)
	closed := errors.New("source closed")
	err := Pump(context.Background(), conn, errSource{closed}, pumpOptions(time.Hour))
	if !errors.Is(err, closed) {
		t.Fatalf("Pump = %v, want the source's error", err)
	}
}

type errSource struct{ err error }

func (s errSource) Next() (Frame, <-chan struct{}, error) { return Frame{}, nil, s.err }

func TestPumpChanWritesTextAndStopsOnDone(t *testing.T) {
	conn, p := dial(t, true)
	frames := make(chan []byte, 4)
	done := make(chan struct{})
	result := make(chan error, 1)
	go func() {
		result <- PumpChan(context.Background(), conn, frames, done, pumpOptions(time.Hour))
	}()
	frames <- []byte("one")
	frames <- []byte("two")
	for _, w := range []string{"one", "two"} {
		select {
		case got := <-p.messages:
			if got.kind != websocket.MessageText || got.data != w {
				t.Fatalf("got %+v, want text %q", got, w)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("%q never arrived", w)
		}
	}
	close(done)
	select {
	case err := <-result:
		if err != nil {
			t.Fatalf("PumpChan = %v, want nil once done closes", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("PumpChan did not stop when done closed")
	}
}

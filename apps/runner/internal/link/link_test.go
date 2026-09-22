package link_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// A fake control plane: accepts the upgrade, checks the bearer, reads hello,
// answers welcome (or a hint), and hands the socket to the test.

type controlPlane struct {
	t           *testing.T
	server      *httptest.Server
	fingerprint string
	refuse      *link.Hint
	mu          sync.Mutex
	bearers     []string
	conns       chan *websocket.Conn
	hellos      chan link.Hello
}

func newControlPlane(t *testing.T) *controlPlane {
	cp := &controlPlane{t: t, fingerprint: strings.Repeat("ab", 32), conns: make(chan *websocket.Conn, 8), hellos: make(chan link.Hello, 8)}
	var epochs uint64
	cp.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != link.Path {
			http.NotFound(w, r)
			return
		}
		bearer := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		cp.mu.Lock()
		cp.bearers = append(cp.bearers, bearer)
		cp.mu.Unlock()
		if bearer == "" || bearer == "bad" {
			http.Error(w, "boot assertion rejected", http.StatusUnauthorized)
			return
		}
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		ctx := context.Background()
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var hello link.Hello
		if err := json.Unmarshal(data, &hello); err != nil || hello.Type != "hello" {
			conn.Close(4400, "hello expected")
			return
		}
		cp.hellos <- hello
		if cp.refuse != nil {
			body, _ := json.Marshal(cp.refuse)
			_ = conn.Write(ctx, websocket.MessageText, body)
			conn.Close(4426, "update required")
			return
		}
		epochs++
		body, _ := json.Marshal(link.Welcome{Type: "welcome", Protocol: link.ProtocolVersion, KeyFingerprint: cp.fingerprint, HostID: "host-1", Epoch: epochs})
		_ = conn.Write(ctx, websocket.MessageText, body)
		cp.conns <- conn
	}))
	t.Cleanup(cp.server.Close)
	return cp
}

func (cp *controlPlane) bearerCount() int {
	cp.mu.Lock()
	defer cp.mu.Unlock()
	return len(cp.bearers)
}

// recorder is a Handler that records what the link told it.
type recorder struct {
	mu           sync.Mutex
	connected    []uint64
	disconnected []uint64
	messages     []link.Message
	frames       [][]byte
}

func (r *recorder) Hello(context.Context) (link.Hello, error) {
	return link.Hello{RunnerVersion: "0.4.1", RunID: "run-1", Host: hostdomain.Facts{Platform: "linux", Arch: "amd64", Tools: []hostdomain.Tool{}}, Sessions: []link.SessionSnapshot{}}, nil
}

func (r *recorder) Heartbeat(context.Context) (link.Heartbeat, error) {
	return link.Heartbeat{Channel: "stable", Host: hostdomain.Facts{Platform: "linux"}, Sessions: []link.SessionSnapshot{}}, nil
}

func (r *recorder) Connected(_ context.Context, epoch uint64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.connected = append(r.connected, epoch)
}

func (r *recorder) Disconnected(epoch uint64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.disconnected = append(r.disconnected, epoch)
}

func (r *recorder) Message(_ context.Context, msg link.Message) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.messages = append(r.messages, msg)
}

func (r *recorder) Frame(_ context.Context, id uint32, bytes []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.frames = append(r.frames, link.EncodeFrame(id, bytes))
}

func (r *recorder) count(of func(*recorder) int) func() int {
	return func() int {
		r.mu.Lock()
		defer r.mu.Unlock()
		return of(r)
	}
}

func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func client(t *testing.T, cp *controlPlane, handler link.Handler, token string) *link.Client {
	t.Helper()
	c, err := link.New(link.Options{
		ControlPlaneURL: cp.server.URL,
		Token:           func(context.Context) (string, error) { return token, nil },
		Fingerprint:     cp.fingerprint,
		Handler:         handler,
		Logger:          slog.New(slog.NewTextHandler(testWriter{t}, &slog.HandlerOptions{Level: slog.LevelDebug})),
		Ladder:          []time.Duration{20 * time.Millisecond},
		Heartbeat:       50 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

type testWriter struct{ t *testing.T }

func (w testWriter) Write(p []byte) (int, error) {
	w.t.Log(strings.TrimSpace(string(p)))
	return len(p), nil
}

func TestDialsWithABootTokenSaysHelloAndReadsWelcome(t *testing.T) {
	cp := newControlPlane(t)
	rec := &recorder{}
	c := client(t, cp, rec, "token-1")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)

	hello := <-cp.hellos
	if hello.Protocol != (link.Range{Min: 1, Max: 1}) || hello.RunID != "run-1" {
		t.Fatalf("hello = %+v", hello)
	}
	eventually(t, "connected callback", func() bool { return rec.count(func(r *recorder) int { return len(r.connected) })() == 1 })
	if !c.Live() || c.Epoch() != 1 {
		t.Fatalf("live=%v epoch=%d", c.Live(), c.Epoch())
	}
	cp.mu.Lock()
	bearer := cp.bearers[0]
	cp.mu.Unlock()
	if bearer != "token-1" {
		t.Fatalf("bearer = %q", bearer)
	}
}

func TestRedialsWithAFreshTokenAndBumpsTheEpoch(t *testing.T) {
	cp := newControlPlane(t)
	rec := &recorder{}
	tokens := 0
	c, _ := link.New(link.Options{
		ControlPlaneURL: cp.server.URL,
		Token: func(context.Context) (string, error) {
			tokens++
			return "token-" + string(rune('0'+tokens)), nil
		},
		Fingerprint: cp.fingerprint, Handler: rec,
		Ladder: []time.Duration{20 * time.Millisecond}, Heartbeat: time.Hour,
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)

	first := <-cp.conns
	eventually(t, "first link", func() bool { return c.Epoch() == 1 })
	first.Close(websocket.StatusGoingAway, "relay restarting")

	<-cp.conns
	eventually(t, "second link", func() bool { return c.Epoch() == 2 })
	eventually(t, "disconnect callback for epoch 1", func() bool {
		rec.mu.Lock()
		defer rec.mu.Unlock()
		return len(rec.disconnected) == 1 && rec.disconnected[0] == 1
	})
	if cp.bearerCount() != 2 {
		t.Fatalf("expected a new token per dial, saw %d", cp.bearerCount())
	}
}

func TestRefusesAControlPlaneWithAnotherKey(t *testing.T) {
	cp := newControlPlane(t)
	cp.fingerprint = strings.Repeat("cd", 32)
	rec := &recorder{}
	c, _ := link.New(link.Options{
		ControlPlaneURL: cp.server.URL,
		Token:           func(context.Context) (string, error) { return "token", nil },
		Fingerprint:     strings.Repeat("ab", 32), Handler: rec,
		Ladder: []time.Duration{20 * time.Millisecond}, Heartbeat: time.Hour,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	c.Run(ctx)
	if c.Epoch() != 0 {
		t.Fatalf("a mismatched fingerprint must never become a link; epoch=%d", c.Epoch())
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if len(rec.connected) != 0 {
		t.Fatal("connected callback ran for a refused link")
	}
}

func TestSurfacesAnUpdateRequiredHintAtHello(t *testing.T) {
	cp := newControlPlane(t)
	cp.refuse = &link.Hint{Type: "hint", Kind: "update_required", Detail: "below min_supported"}
	rec := &recorder{}
	c := client(t, cp, rec, "token")
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	c.Run(ctx)
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if len(rec.messages) == 0 || rec.messages[0].Type != "hint" {
		t.Fatalf("hint not surfaced: %+v", rec.messages)
	}
}

func TestCarriesFramesAndControlMessagesBothWays(t *testing.T) {
	cp := newControlPlane(t)
	rec := &recorder{}
	c := client(t, cp, rec, "token")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)
	conn := <-cp.conns
	eventually(t, "link", c.Live)

	// Control plane → runner: a session.attach and a binary frame.
	body, _ := json.Marshal(link.SessionAttach{Type: "session.attach", CommandID: "c1", SessionID: "s1", AttachmentID: 7, Cols: 80, Rows: 24})
	if err := conn.Write(ctx, websocket.MessageText, body); err != nil {
		t.Fatal(err)
	}
	if err := conn.Write(ctx, websocket.MessageBinary, link.EncodeFrame(7, []byte("ls\r"))); err != nil {
		t.Fatal(err)
	}
	eventually(t, "attach message", func() bool { return rec.count(func(r *recorder) int { return len(r.messages) })() >= 1 })
	eventually(t, "frame", func() bool { return rec.count(func(r *recorder) int { return len(r.frames) })() == 1 })
	rec.mu.Lock()
	var attach link.SessionAttach
	_ = rec.messages[0].Decode(&attach)
	frame := rec.frames[0]
	rec.mu.Unlock()
	if attach.AttachmentID != 7 || attach.Cols != 80 {
		t.Fatalf("attach = %+v", attach)
	}
	if id, bytes, _ := link.DecodeFrame(frame); id != 7 || string(bytes) != "ls\r" {
		t.Fatalf("frame = %d %q", id, bytes)
	}

	// Runner → control plane: a PTY frame and a command.failed, in order.
	if err := c.SendFrame(7, []byte("$ ")); err != nil {
		t.Fatal(err)
	}
	if err := c.Send(link.CommandFailed{Type: "command.failed", CommandID: "c2", Code: "SESS_003"}); err != nil {
		t.Fatal(err)
	}
	kind, data, err := conn.Read(ctx)
	if err != nil || kind != websocket.MessageBinary {
		t.Fatalf("expected a binary frame first: %v %v", kind, err)
	}
	if id, bytes, _ := link.DecodeFrame(data); id != 7 || string(bytes) != "$ " {
		t.Fatalf("frame = %d %q", id, bytes)
	}
	kind, data, err = conn.Read(ctx)
	if err != nil || kind != websocket.MessageText || !strings.Contains(string(data), `"command.failed"`) {
		t.Fatalf("expected command.failed: %v %s %v", kind, data, err)
	}

	// The heartbeat arrives on its own.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		_, data, err = conn.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), `"heartbeat"`) {
			return
		}
	}
	t.Fatal("no heartbeat within 2 s")
}

func TestSendBetweenLinksIsRefusedNotQueued(t *testing.T) {
	cp := newControlPlane(t)
	c := client(t, cp, &recorder{}, "token")
	if err := c.Send(link.CommandFailed{Type: "command.failed"}); !errors.Is(err, link.ErrNotConnected) {
		t.Fatalf("expected ErrNotConnected, got %v", err)
	}
}

func TestRejectsAControlPlaneURLThatIsNotHTTP(t *testing.T) {
	_, err := link.New(link.Options{
		ControlPlaneURL: "ftp://example.com",
		Token:           func(context.Context) (string, error) { return "", nil },
		Handler:         &recorder{},
	})
	if err == nil {
		t.Fatal("expected an error")
	}
}

package link

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

// Path is where the control plane mounts the runner link, under its `/api/v1`.
const Path = "/api/v1/relay/runner"

// HeartbeatInterval is 01's 15 s.
const HeartbeatInterval = 15 * time.Second

// Ladder is the reconnect ladder, with jitter applied on top
// (`12-lessons-from-grok-bot.md`).
var Ladder = []time.Duration{500 * time.Millisecond, time.Second, 2 * time.Second, 5 * time.Second, 10 * time.Second, 30 * time.Second}

// sendQueue bounds what a slow link can hold; a full queue drops the frame
// rather than the process, and a dropped PTY read is a repaint away.
const sendQueue = 1024

// Handler is what the composition root supplies: what each control-plane
// message does, and what happens when the link comes and goes.
type Handler interface {
	// Hello builds the first frame's body for a fresh dial: host facts and the
	// snapshot of what this runner holds.
	Hello(ctx context.Context) (Hello, error)
	// Heartbeat builds the periodic report.
	Heartbeat(ctx context.Context) (Heartbeat, error)
	// Connected runs after welcome, once per epoch.
	Connected(ctx context.Context, epoch uint64)
	// Disconnected runs when a link drops, before the next dial.
	Disconnected(epoch uint64)
	// Message is one control frame from the control plane.
	Message(ctx context.Context, msg Message)
	// Frame is one binary frame (keystrokes never travel this way today, but
	// the layout is symmetric and a peer may use it).
	Frame(ctx context.Context, attachmentID uint32, bytes []byte)
}

// Options configure the client.
type Options struct {
	// ControlPlaneURL is the bare origin the host was paired with.
	ControlPlaneURL string
	// Token mints the per-dial boot JWT.
	Token func(ctx context.Context) (string, error)
	// Fingerprint is the control plane's key fingerprint the host pinned at
	// registration; a welcome naming another is refused (01 F6).
	Fingerprint string
	Handler     Handler
	UserAgent   string
	Logger      *slog.Logger
	HTTP        *http.Client
	// Ladder overrides the reconnect ladder, for tests.
	Ladder []time.Duration
	// Heartbeat overrides the interval, for tests.
	Heartbeat time.Duration
}

// Client keeps one link open to the control plane for the life of a context.
type Client struct {
	opts   Options
	logger *slog.Logger

	mu    sync.Mutex
	conn  *websocket.Conn
	send  chan []byte
	epoch atomic.Uint64
	// connected is closed-and-replaced per link so callers can wait for one.
	live atomic.Bool
}

// New builds a client; Run dials.
func New(opts Options) (*Client, error) {
	if opts.Handler == nil || opts.Token == nil {
		return nil, errors.New("link: a handler and a token minter are required")
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	if opts.Ladder == nil {
		opts.Ladder = Ladder
	}
	if opts.Heartbeat == 0 {
		opts.Heartbeat = HeartbeatInterval
	}
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	if _, err := dialURL(opts.ControlPlaneURL); err != nil {
		return nil, err
	}
	return &Client{opts: opts, logger: opts.Logger}, nil
}

// dialURL turns the paired origin into the link's WebSocket URL.
func dialURL(origin string) (string, error) {
	u, err := url.Parse(strings.TrimRight(origin, "/"))
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("link: control plane URL %q is not usable", origin)
	}
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		u.Scheme = "ws"
	default:
		return "", fmt.Errorf("link: control plane URL %q is not http(s)", origin)
	}
	u.Path = Path
	u.RawQuery = ""
	return u.String(), nil
}

// Epoch is the number of links accepted so far; frames and callbacks from an
// older epoch are dropped by whoever holds one.
func (c *Client) Epoch() uint64 { return c.epoch.Load() }

// Live reports whether a link is up right now.
func (c *Client) Live() bool { return c.live.Load() }

// Run dials and keeps dialling until ctx ends. Every dial mints a fresh boot
// token; a refusal with `update_required` is surfaced to the handler as a
// hint message and then treated like any other drop.
func (c *Client) Run(ctx context.Context) {
	attempt := 0
	for {
		start := time.Now()
		err := c.dialOnce(ctx)
		if ctx.Err() != nil {
			return
		}
		// A link that held for a while resets the ladder: the next drop is a
		// fresh incident, not the same one.
		if time.Since(start) > 30*time.Second {
			attempt = 0
		}
		delay := c.backoff(attempt)
		attempt++
		c.logger.Warn("control-plane link down; redialling",
			slog.Any("error", err), slog.Duration("in", delay))
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}

func (c *Client) backoff(attempt int) time.Duration {
	ladder := c.opts.Ladder
	if attempt >= len(ladder) {
		attempt = len(ladder) - 1
	}
	base := ladder[attempt]
	// ±20 % jitter, so a fleet that lost the same relay does not redial as one.
	jitter := time.Duration(rand.Int64N(int64(base)/5+1)) - base/10
	return base + jitter
}

func (c *Client) dialOnce(ctx context.Context) error {
	token, err := c.opts.Token(ctx)
	if err != nil {
		return fmt.Errorf("mint boot token: %w", err)
	}
	target, _ := dialURL(c.opts.ControlPlaneURL)
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	if c.opts.UserAgent != "" {
		header.Set("User-Agent", c.opts.UserAgent)
	}
	dialCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	conn, resp, err := websocket.Dial(dialCtx, target, &websocket.DialOptions{
		HTTPClient: c.opts.HTTP, HTTPHeader: header,
	})
	cancel()
	if resp != nil && resp.Body != nil {
		// The handshake response carries nothing the link reads; a refusal's
		// status is enough for the log.
		_ = resp.Body.Close()
	}
	if err != nil {
		if resp != nil {
			return fmt.Errorf("dial refused: HTTP %d", resp.StatusCode)
		}
		return fmt.Errorf("dial: %w", err)
	}
	conn.SetReadLimit(16 << 20)
	defer conn.CloseNow() //nolint:errcheck // a closing link has nothing to report

	linkCtx, stop := context.WithCancel(ctx)
	defer stop()

	hello, err := c.opts.Handler.Hello(linkCtx)
	if err != nil {
		return fmt.Errorf("build hello: %w", err)
	}
	hello.Type = "hello"
	hello.Protocol = Range{Min: ProtocolVersion, Max: ProtocolVersion}
	if err := writeJSON(linkCtx, conn, hello); err != nil {
		return fmt.Errorf("send hello: %w", err)
	}

	welcome, err := c.readWelcome(linkCtx, conn)
	if err != nil {
		return err
	}
	if c.opts.Fingerprint != "" && !strings.EqualFold(welcome.KeyFingerprint, c.opts.Fingerprint) {
		// F6: the host pins the control plane's key at registration and refuses
		// any other. The socket is TLS-authenticated already; this catches a
		// control plane that was re-keyed without re-pairing its hosts.
		return fmt.Errorf("control plane key fingerprint %q is not the pinned %q",
			welcome.KeyFingerprint, c.opts.Fingerprint)
	}

	epoch := c.epoch.Add(1)
	send := make(chan []byte, sendQueue)
	c.mu.Lock()
	c.conn, c.send = conn, send
	c.mu.Unlock()
	c.live.Store(true)
	defer func() {
		c.live.Store(false)
		c.mu.Lock()
		if c.conn == conn {
			c.conn, c.send = nil, nil
		}
		c.mu.Unlock()
		c.opts.Handler.Disconnected(epoch)
	}()

	c.logger.Info("control-plane link up", slog.String("host", welcome.HostID), slog.Uint64("epoch", epoch))
	c.opts.Handler.Connected(linkCtx, epoch)

	errc := make(chan error, 3)
	go func() { errc <- c.writeLoop(linkCtx, conn, send) }()
	go func() { errc <- c.heartbeatLoop(linkCtx) }()
	go func() { errc <- c.readLoop(linkCtx, conn) }()
	err = <-errc
	stop()
	return err
}

func (c *Client) readWelcome(ctx context.Context, conn *websocket.Conn) (Welcome, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	kind, data, err := conn.Read(ctx)
	if err != nil {
		return Welcome{}, fmt.Errorf("read welcome: %w", err)
	}
	if kind != websocket.MessageText {
		return Welcome{}, errors.New("welcome expected, got a binary frame")
	}
	var env Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		return Welcome{}, fmt.Errorf("welcome expected: %w", err)
	}
	switch env.Type {
	case "welcome":
		var welcome Welcome
		if err := json.Unmarshal(data, &welcome); err != nil {
			return Welcome{}, fmt.Errorf("decode welcome: %w", err)
		}
		return welcome, nil
	case "hint":
		// Refused at hello, with the reason: surfaced so the update loop can
		// act on `update_required` rather than the runner redialling forever.
		c.opts.Handler.Message(ctx, Message{Type: env.Type, Raw: data})
		var hint Hint
		_ = json.Unmarshal(data, &hint)
		return Welcome{}, fmt.Errorf("refused at hello: %s %s", hint.Kind, hint.Detail)
	default:
		return Welcome{}, fmt.Errorf("welcome expected, got %q", env.Type)
	}
}

func (c *Client) readLoop(ctx context.Context, conn *websocket.Conn) error {
	for {
		kind, data, err := conn.Read(ctx)
		if err != nil {
			return fmt.Errorf("read: %w", err)
		}
		switch kind {
		case websocket.MessageBinary:
			if id, bytes, ok := DecodeFrame(data); ok {
				c.opts.Handler.Frame(ctx, id, bytes)
			}
		case websocket.MessageText:
			var env Envelope
			if err := json.Unmarshal(data, &env); err != nil || env.Type == "" {
				c.logger.Warn("unparseable control frame from the control plane")
				continue
			}
			c.opts.Handler.Message(ctx, Message{Type: env.Type, Raw: data})
		}
	}
}

// writeLoop is the one goroutine that writes: every send is queued, so a PTY
// reader and a heartbeat never interleave a frame.
func (c *Client) writeLoop(ctx context.Context, conn *websocket.Conn, send <-chan []byte) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case frame := <-send:
			kind := websocket.MessageText
			if frame[0] == 0 {
				kind = websocket.MessageBinary
			}
			writeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			err := conn.Write(writeCtx, kind, frame[1:])
			cancel()
			if err != nil {
				return fmt.Errorf("write: %w", err)
			}
		}
	}
}

func (c *Client) heartbeatLoop(ctx context.Context) error {
	ticker := time.NewTicker(c.opts.Heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			beat, err := c.opts.Handler.Heartbeat(ctx)
			if err != nil {
				c.logger.Warn("heartbeat could not be built", slog.Any("error", err))
				continue
			}
			beat.Type = "heartbeat"
			if err := c.Send(beat); err != nil {
				return err
			}
		}
	}
}

// ErrNotConnected is what Send answers between links.
var ErrNotConnected = errors.New("link: not connected")

// ErrBackpressure is what Send answers when the queue is full: the frame is
// dropped, the link is not.
var ErrBackpressure = errors.New("link: send queue full")

// Send queues a JSON control frame.
func (c *Client) Send(message any) error {
	body, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return c.enqueue(append([]byte{1}, body...))
}

// SendFrame queues a PTY frame for an attachment.
func (c *Client) SendFrame(attachmentID uint32, bytes []byte) error {
	return c.enqueue(append([]byte{0}, EncodeFrame(attachmentID, bytes)...))
}

func (c *Client) enqueue(tagged []byte) error {
	c.mu.Lock()
	send := c.send
	c.mu.Unlock()
	if send == nil {
		return ErrNotConnected
	}
	select {
	case send <- tagged:
		return nil
	default:
		return ErrBackpressure
	}
}

func writeJSON(ctx context.Context, conn *websocket.Conn, v any) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return conn.Write(ctx, websocket.MessageText, body)
}

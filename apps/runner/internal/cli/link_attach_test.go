package cli

import (
	"context"
	"io"
	"log/slog"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// heldPTY is an attachment's PTY: reads wait for it to close, a wedged one's
// writes never return until it does, and resizes are recorded.
type heldPTY struct {
	wedged bool

	mu      sync.Mutex
	sizes   []sessionsapp.Size
	written []byte
	closed  chan struct{}
	closing sync.Once
}

func newHeldPTY(wedged bool) *heldPTY { return &heldPTY{wedged: wedged, closed: make(chan struct{})} }

func (p *heldPTY) Read([]byte) (int, error) {
	<-p.closed
	return 0, io.EOF
}

func (p *heldPTY) Write(b []byte) (int, error) {
	if p.wedged {
		<-p.closed
		return 0, io.ErrClosedPipe
	}
	p.mu.Lock()
	p.written = append(p.written, b...)
	p.mu.Unlock()
	return len(b), nil
}

func (p *heldPTY) Resize(size sessionsapp.Size) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sizes = append(p.sizes, size)
	return nil
}

func (p *heldPTY) Close() error {
	p.closing.Do(func() { close(p.closed) })
	return nil
}

func (p *heldPTY) isClosed() bool {
	select {
	case <-p.closed:
		return true
	default:
		return false
	}
}

func (p *heldPTY) resizes() []sessionsapp.Size {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]sessionsapp.Size(nil), p.sizes...)
}

// heldAttach is tmux whose `attach` waits to be let through when gate is set,
// and hands out pty.
type heldAttach struct {
	*fake.Terminals
	pty     *heldPTY
	gate    chan struct{}
	entered chan struct{}
}

func (t *heldAttach) Attach(context.Context, string, sessionsapp.Size) (sessionsapp.Attachment, error) {
	t.entered <- struct{}{}
	if t.gate != nil {
		<-t.gate
	}
	return t.pty, nil
}

const attachmentUnderTest = 7

// newAttachHarness is a handler on link epoch 1 with one running session,
// whose attachments open onto pty.
func newAttachHarness(t *testing.T, pty *heldPTY, gate chan struct{}) (*linkHandler, *capturedLink, *heldAttach) {
	t.Helper()
	terminals := &heldAttach{Terminals: fake.NewTerminals(), pty: pty, gate: gate, entered: make(chan struct{}, 4)}
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{Sessions: svc}, logger: logger, client: sent,
		reporter:    link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() {
		_ = pty.Close()
		h.lanes.close(time.Second)
	})
	h.Connected(context.Background(), 1)
	h.Message(context.Background(), createMessage(t, "11111111-1111-4111-8111-111111111111"))
	deadline := time.Now().Add(2 * time.Second)
	for {
		if session, err := svc.Get(sessionUnderTest); err == nil && session.State.Live() {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the session never started")
		}
		time.Sleep(time.Millisecond)
	}
	return h, sent, terminals
}

func attachMessage(t *testing.T) link.Message {
	return message(t, "session.attach", map[string]any{
		"commandId": "55555555-5555-4555-8555-555555555555", "sessionId": sessionUnderTest,
		"attachmentId": attachmentUnderTest, "window": 0, "cols": 80, "rows": 24,
	})
}

func resizeMessage(t *testing.T, cols int) link.Message {
	return message(t, "session.resize", map[string]any{
		"sessionId": sessionUnderTest, "attachmentId": attachmentUnderTest, "cols": cols, "rows": 40,
	})
}

func waitForAttachment(t *testing.T, h *linkHandler) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if h.attachmentByID(attachmentUnderTest) != nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("the attachment never opened")
		}
		time.Sleep(time.Millisecond)
	}
}

// One wedged `tmux attach` client must not stop the read loop, which carries
// every other attachment's keystrokes and the link's pongs. Its queue fills,
// and that attachment alone is closed.
func TestFrameToAWedgedPTYDoesNotBlock(t *testing.T) {
	pty := newHeldPTY(true)
	h, sent, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)

	returned := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			h.Frame(context.Background(), attachmentUnderTest, []byte("k"))
		}
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(time.Second):
		t.Fatal("Frame blocked on a PTY that takes no input")
	}

	closed := sent.waitFor(t, "attachment.closed", func(m any) bool {
		c, ok := m.(link.AttachmentClosed)
		return ok && c.AttachmentID == attachmentUnderTest
	}).(link.AttachmentClosed)
	if closed.Reason != "input stalled" {
		t.Fatalf("closed with %q", closed.Reason)
	}
	if !pty.isClosed() {
		t.Fatal("the wedged PTY was left open")
	}
	if h.attachmentByID(attachmentUnderTest) != nil {
		t.Fatal("the wedged attachment is still in the table")
	}
}

func TestFramesReachThePTYInOrder(t *testing.T) {
	pty := newHeldPTY(false)
	h, _, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)

	// One buffer for every frame, as the read loop reuses its own: each frame
	// must be copied before the next overwrites it.
	frame := make([]byte, 1)
	for i := 0; i < 10; i++ {
		frame[0] = byte('0' + i)
		h.Frame(context.Background(), attachmentUnderTest, frame)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		pty.mu.Lock()
		written := string(pty.written)
		pty.mu.Unlock()
		if written == "0123456789" {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("the PTY got %q, want every frame in order", written)
		}
		time.Sleep(time.Millisecond)
	}
}

// The link drops while tmux attaches. The id belonged to that link — the next
// may give it to another browser — so the PTY is closed, not streamed there.
func TestAttachFinishingAfterDisconnectIsDropped(t *testing.T) {
	pty := newHeldPTY(false)
	gate := make(chan struct{})
	h, _, terminals := newAttachHarness(t, pty, gate)

	h.Message(context.Background(), attachMessage(t))
	<-terminals.entered
	h.Disconnected(1)
	close(gate)

	deadline := time.Now().Add(2 * time.Second)
	for !pty.isClosed() {
		if time.Now().After(deadline) {
			t.Fatal("the PTY opened for a link that is gone was left open")
		}
		time.Sleep(time.Millisecond)
	}
	h.mu.Lock()
	open := len(h.attachments)
	h.mu.Unlock()
	if open != 0 {
		t.Fatalf("%d attachments in the table after the link went", open)
	}
}

// A resize is an ioctl: it does not wait behind whatever the session's lane
// is doing — a file paste, a slow input.
func TestResizeIsNotQueuedBehindTheLane(t *testing.T) {
	pty := newHeldPTY(false)
	h, _, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)

	block := make(chan struct{})
	defer close(block)
	h.lanes.run(sessionUnderTest, func() { <-block })
	h.Message(context.Background(), resizeMessage(t, 120))

	if sizes := pty.resizes(); len(sizes) != 1 || sizes[0].Cols != 120 {
		t.Fatalf("resizes = %+v, want 120 columns applied at once", sizes)
	}
}

// A resize that arrives while its attach is still opening is not lost: it
// keeps its place behind the attach.
func TestAResizeBeforeItsAttachIsAppliedAfterIt(t *testing.T) {
	pty := newHeldPTY(false)
	gate := make(chan struct{})
	h, _, terminals := newAttachHarness(t, pty, gate)

	h.Message(context.Background(), attachMessage(t))
	<-terminals.entered
	h.Message(context.Background(), resizeMessage(t, 132))
	close(gate)

	deadline := time.Now().Add(2 * time.Second)
	for {
		if sizes := pty.resizes(); len(sizes) == 1 && sizes[0].Cols == 132 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("resizes = %+v, want the early resize applied once the attach opened", pty.resizes())
		}
		time.Sleep(time.Millisecond)
	}
}

// inputPumps counts the goroutines writing an attachment's keystrokes.
func inputPumps() int {
	buf := make([]byte, 1<<20)
	for {
		n := runtime.Stack(buf, true)
		if n < len(buf) {
			return strings.Count(string(buf[:n]), "(*linkHandler).inputPump(")
		}
		buf = make([]byte, 2*len(buf))
	}
}

// A PTY that ends on its own — the window closed, tmux went — takes its
// input goroutine with it, not only its table entry.
func TestAPTYEndingOnItsOwnStopsItsInputPump(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, _ := newAttachHarness(t, pty, nil)
	before := inputPumps()
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	if running := inputPumps(); running != before+1 {
		t.Fatalf("%d input pumps after the attach, want %d", running, before+1)
	}

	_ = pty.Close() // Read now returns EOF: the PTY ended, not the host.
	sent.waitFor(t, "attachment.closed", func(m any) bool {
		c, ok := m.(link.AttachmentClosed)
		return ok && c.AttachmentID == attachmentUnderTest && c.Reason == "pty closed"
	})

	deadline := time.Now().Add(2 * time.Second)
	for inputPumps() != before {
		if time.Now().After(deadline) {
			t.Fatal("the input pump of an attachment whose PTY ended is still running")
		}
		time.Sleep(time.Millisecond)
	}
}

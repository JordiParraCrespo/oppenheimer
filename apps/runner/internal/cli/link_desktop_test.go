package cli

import (
	"bytes"
	"context"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	desktopapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/app"
	desktopdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// savedDesktop is the host owner's `runner desktop` choice, in memory, read
// by the daemon while the test, standing in for the CLI, changes it.
type savedDesktop struct {
	mu       sync.Mutex
	settings desktopdomain.Settings
}

func (s *savedDesktop) Load() (desktopdomain.Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.settings, nil
}

func (s *savedDesktop) Save(v desktopdomain.Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings = v
	return nil
}

// rfbServer is a screen-sharing server that asks for no password and keeps
// every byte a client sends after the handshake.
type rfbServer struct {
	port int
	mu   sync.Mutex
	got  []byte
}

func newRFBServer(t *testing.T) *rfbServer {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	s := &rfbServer{port: ln.Addr().(*net.TCPAddr).Port}
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer func() { _ = conn.Close() }()
		_, _ = conn.Write([]byte("RFB 003.008\n"))
		version := make([]byte, 12)
		if _, err := io.ReadFull(conn, version); err != nil {
			return
		}
		_, _ = conn.Write([]byte{1, 1})
		choice := make([]byte, 1)
		if _, err := io.ReadFull(conn, choice); err != nil {
			return
		}
		_, _ = conn.Write([]byte{0, 0, 0, 0})
		buf := make([]byte, 1024)
		for {
			n, err := conn.Read(buf)
			s.mu.Lock()
			s.got = append(s.got, buf[:n]...)
			s.mu.Unlock()
			if err != nil {
				return
			}
		}
	}()
	return s
}

func (s *rfbServer) received() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]byte(nil), s.got...)
}

func (s *rfbServer) waitFor(t *testing.T, want []byte) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !bytes.Equal(s.received(), want) {
		if time.Now().After(deadline) {
			t.Fatalf("the server received %v, want %v", s.received(), want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func desktopHandler(t *testing.T, settings desktopdomain.Settings) (*linkHandler, *capturedLink) {
	t.Helper()
	h, sent := portsHandler(t, nil)
	h.desktop = desktopapp.New(desktopapp.Options{Settings: &savedDesktop{settings: settings}})
	return h, sent
}

func waitFramed(t *testing.T, sent *capturedLink, want string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for sent.framed() != want {
		if time.Now().After(deadline) {
			t.Fatalf("frames to the browser: %q, want %q", sent.framed(), want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// The browser is handed a stream the runner already signed in to: it is
// asked for no password, its session is always shared, and while it only
// watches its clicks never reach the server; taking control lets them.
func TestADesktopAsksTheBrowserForNoPasswordAndDropsItsInputUntilItTakesControl(t *testing.T) {
	server := newRFBServer(t)
	h, sent := desktopHandler(t, desktopdomain.Settings{Enabled: true, Port: server.port})

	h.Message(context.Background(), message(t, link.TypeDesktopOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "attachmentId": 13, "control": false,
	}))
	sent.waitFor(t, "desktop.opened", func(m any) bool {
		opened, ok := m.(link.DesktopOpened)
		return ok && opened.AttachmentID == 13
	})
	waitFramed(t, sent, "RFB 003.008\n")

	h.Frame(context.Background(), 13, []byte("RFB 003.008\n"))
	waitFramed(t, sent, "RFB 003.008\n\x01\x01")
	h.Frame(context.Background(), 13, []byte{1})
	waitFramed(t, sent, "RFB 003.008\n\x01\x01\x00\x00\x00\x00")

	click := []byte{5, 1, 0, 10, 0, 20}
	update := []byte{3, 0, 0, 0, 0, 0, 0x04, 0, 0x03, 0}
	h.Frame(context.Background(), 13, append(append([]byte{0}, click...), update...))
	server.waitFor(t, append([]byte{1}, update...))

	h.Message(context.Background(), message(t, link.TypeDesktopControl, map[string]any{
		"attachmentId": 13, "control": true,
	}))
	h.Frame(context.Background(), 13, click)
	server.waitFor(t, append(append([]byte{1}, update...), click...))

	h.Message(context.Background(), message(t, link.TypeDesktopClose, map[string]any{"attachmentId": 13}))
	if h.tunnelByID(13) != nil {
		t.Fatal("desktop.close left the desktop open")
	}
}

// A host whose owner did not share its desktop dials nothing.
func TestADesktopTheHostDoesNotShareIsRefused(t *testing.T) {
	server := newRFBServer(t)
	h, sent := desktopHandler(t, desktopdomain.Settings{Enabled: false, Port: server.port})

	h.Message(context.Background(), message(t, link.TypeDesktopOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "attachmentId": 14, "control": true,
	}))
	failed := sent.waitFor(t, "command.failed", func(m any) bool {
		_, ok := m.(link.CommandFailed)
		return ok
	}).(link.CommandFailed)
	if failed.Code != "DESKTOP_001" {
		t.Fatalf("refused with %s, want DESKTOP_001", failed.Code)
	}
	if h.tunnelByID(14) != nil {
		t.Fatal("a desktop opened on a host that does not share it")
	}
}

// `runner desktop off` is another process: the daemon cuts off a desktop
// already streaming, in control or not, the next time it reads the choice.
func TestADesktopAlreadyOpenClosesWhenTheHostStopsSharingIt(t *testing.T) {
	server := newRFBServer(t)
	saved := &savedDesktop{settings: desktopdomain.Settings{Enabled: true, Port: server.port}}
	h, sent := portsHandler(t, nil)
	h.desktop = desktopapp.New(desktopapp.Options{Settings: saved})
	h.desktopRecheck = 10 * time.Millisecond

	h.Message(context.Background(), message(t, link.TypeDesktopOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "attachmentId": 15, "control": true,
	}))
	sent.waitFor(t, "desktop.opened", func(m any) bool {
		_, ok := m.(link.DesktopOpened)
		return ok
	})

	_ = saved.Save(desktopdomain.Settings{Enabled: false, Port: server.port})
	sent.waitFor(t, "attachment.closed", func(m any) bool {
		closed, ok := m.(link.AttachmentClosed)
		return ok && closed.AttachmentID == 15
	})
	if h.tunnelByID(15) != nil {
		t.Fatal("the desktop stayed open after the host stopped sharing it")
	}
}

// hostPointer is where the host's pointer is, moved by the test.
type hostPointer struct {
	mu sync.Mutex
	at desktopdomain.Pointer
}

func (p *hostPointer) Pointer() (desktopdomain.Pointer, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.at, true
}

func (p *hostPointer) move(x, y float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.at = desktopdomain.Pointer{X: x, Y: y, Width: 1920, Height: 1080}
}

func pointerAt(x, y float64) func(any) bool {
	return func(m any) bool {
		p, ok := m.(link.DesktopPointer)
		return ok && p.AttachmentID == 16 && p.X == x && p.Y == y && p.Width == 1920 && p.Height == 1080
	}
}

// Apple's Screen Sharing never says where its pointer is, so a watching
// browser hears it from the runner as it moves; while the browser drives,
// its own pointer is the host's and nothing is sent; back to watching, it
// hears where the pointer went meanwhile. A runner that kept sending while
// in control would draw a second pointer; one that only sent on a move would
// leave the drawn one where control began.
func TestAWatchedDesktopSendsTheHostsPointerAndStopsWhileInControl(t *testing.T) {
	server := newRFBServer(t)
	pointer := &hostPointer{}
	pointer.move(10, 20)
	h, sent := portsHandler(t, nil)
	h.desktop = desktopapp.New(desktopapp.Options{
		Settings: &savedDesktop{settings: desktopdomain.Settings{Enabled: true, Port: server.port}},
		Pointer:  pointer,
	})
	h.desktopPointerEvery = time.Millisecond

	h.Message(context.Background(), message(t, link.TypeDesktopOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "attachmentId": 16, "control": false,
	}))
	sent.waitFor(t, "the pointer where it rests", pointerAt(10, 20))
	pointer.move(30, 40)
	sent.waitFor(t, "the pointer once it moved", pointerAt(30, 40))

	h.Message(context.Background(), message(t, link.TypeDesktopControl, map[string]any{
		"attachmentId": 16, "control": true,
	}))
	time.Sleep(20 * time.Millisecond)
	pointer.move(50, 60)
	time.Sleep(50 * time.Millisecond)
	sent.mu.Lock()
	for _, m := range sent.sent {
		if pointerAt(50, 60)(m) {
			sent.mu.Unlock()
			t.Fatal("the pointer was sent while the browser was in control")
		}
	}
	sent.mu.Unlock()

	h.Message(context.Background(), message(t, link.TypeDesktopControl, map[string]any{
		"attachmentId": 16, "control": false,
	}))
	sent.waitFor(t, "the pointer back to watching", pointerAt(50, 60))
	h.Message(context.Background(), message(t, link.TypeDesktopClose, map[string]any{"attachmentId": 16}))
}

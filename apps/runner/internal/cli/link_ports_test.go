package cli

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	portsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/app"
	portsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

const portsSession = "3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40"

// sessionListeners says the session listens on the given loopback ports.
type sessionListeners map[string][]int

func (s sessionListeners) Of(_ context.Context, sessionID string) ([]portsdomain.Listener, error) {
	var out []portsdomain.Listener
	for _, port := range s[sessionID] {
		out = append(out, portsdomain.Listener{Port: port, Addr: netip.MustParseAddr("127.0.0.1"), Process: "node"})
	}
	return out, nil
}

// echoServer answers every connection with what it was sent, upper-cased.
func echoServer(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				defer func() { _ = conn.Close() }()
				buf := make([]byte, 1024)
				for {
					n, err := conn.Read(buf)
					if n > 0 {
						_, _ = conn.Write([]byte(strings.ToUpper(string(buf[:n]))))
					}
					if err != nil {
						return
					}
				}
			}()
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port
}

func portsHandler(t *testing.T, listeners sessionListeners) (*linkHandler, *capturedLink) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{}, logger: logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
		ports: portsapp.New(portsapp.Options{Listeners: listeners}), tunnels: map[uint32]*tunnel{},
	}
	t.Cleanup(func() { h.lanes.close(time.Second) })
	h.Connected(context.Background(), 1)
	return h, sent
}

// The relay's bytes reach the session's port and its answer comes back as
// frames under the attachment, with each frame the port took credited.
func TestPortOpenTunnelsBytesBothWaysAndCreditsWhatThePortTook(t *testing.T) {
	port := echoServer(t)
	h, sent := portsHandler(t, sessionListeners{portsSession: {port}})

	h.Message(context.Background(), message(t, link.TypePortOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "sessionId": portsSession,
		"attachmentId": 11, "port": port,
	}))
	sent.waitFor(t, "port.opened", func(m any) bool {
		opened, ok := m.(link.PortOpened)
		return ok && opened.AttachmentID == 11
	})

	h.Frame(context.Background(), 11, []byte("get / http/1.1\r\n\r\n"))
	deadline := time.Now().Add(2 * time.Second)
	for sent.framed() != "GET / HTTP/1.1\r\n\r\n" {
		if time.Now().After(deadline) {
			t.Fatalf("the port's answer never came back; frames: %q", sent.framed())
		}
		time.Sleep(10 * time.Millisecond)
	}
	sent.waitFor(t, "a credit for the bytes the port took", func(m any) bool {
		credit, ok := m.(link.AttachmentCredit)
		return ok && credit.AttachmentID == 11 && credit.Bytes == len("get / http/1.1\r\n\r\n")
	})

	// The relay hangs up: the connection closes and nothing more is sent for it.
	h.Message(context.Background(), message(t, link.TypePortClose, map[string]any{"attachmentId": 11}))
	if h.tunnelByID(11) != nil {
		t.Fatal("port.close left the tunnel open")
	}
}

// A port the session does not listen on is never dialled, whatever the relay
// asks: the runner looks the port up itself.
func TestPortOpenRefusesAPortTheSessionDoesNotListenOn(t *testing.T) {
	theirs := echoServer(t)
	h, sent := portsHandler(t, sessionListeners{"another-session": {theirs}})

	h.Message(context.Background(), message(t, link.TypePortOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "sessionId": portsSession,
		"attachmentId": 12, "port": theirs,
	}))
	failed := sent.waitFor(t, "command.failed", func(m any) bool {
		_, ok := m.(link.CommandFailed)
		return ok
	}).(link.CommandFailed)
	if failed.Code != "PORT_001" {
		t.Fatalf("refused with %s, want PORT_001", failed.Code)
	}
	if h.tunnelByID(12) != nil {
		t.Fatal("a tunnel opened to another session's port")
	}
}

// The port hanging up closes the attachment on the relay's side too.
func TestAPortThatHangsUpClosesItsAttachment(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = ln.Close() }()
	go func() {
		conn, err := ln.Accept()
		if err == nil {
			_, _ = conn.Write([]byte("bye"))
			_ = conn.Close()
		}
	}()
	port := ln.Addr().(*net.TCPAddr).Port
	h, sent := portsHandler(t, sessionListeners{portsSession: {port}})

	h.Message(context.Background(), message(t, link.TypePortOpen, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "sessionId": portsSession,
		"attachmentId": 13, "port": port,
	}))
	sent.waitFor(t, "attachment.closed", func(m any) bool {
		closed, ok := m.(link.AttachmentClosed)
		return ok && closed.AttachmentID == 13
	})
	if sent.framed() != "bye" {
		t.Fatalf("frames %q, want what the port said before it hung up", sent.framed())
	}
}

// port.list names the session's ports and no one else's.
func TestPortListNamesTheSessionsPorts(t *testing.T) {
	h, sent := portsHandler(t, sessionListeners{portsSession: {5173, 3001}, "another-session": {8080}})
	h.Message(context.Background(), message(t, link.TypePortList, map[string]any{
		"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "sessionId": portsSession,
	}))
	listing := sent.waitFor(t, "port.listing", func(m any) bool {
		_, ok := m.(link.PortListing)
		return ok
	}).(link.PortListing)
	if len(listing.Ports) != 2 || listing.Ports[0].Port != 3001 || listing.Ports[1].Port != 5173 {
		t.Fatalf("listed %+v, want 3001 and 5173", listing.Ports)
	}
}

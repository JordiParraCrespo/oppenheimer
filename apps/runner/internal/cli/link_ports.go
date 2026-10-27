package cli

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	portsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

// tunnelChunk is the most one frame of a port's bytes carries, well under
// the link's frame cap so a tunnel never holds up the panes beside it.
const tunnelChunk = 64 * 1024

// portListingMax is PORT_LISTING_MAX_ENTRIES in the shared protocol.
const portListingMax = 64

// tunnelInput is how many frames from the control plane may wait for the
// socket. The relay sends no more than a credit window, a few frames of
// tunnelChunk, so a full queue is a relay that broke the window.
const tunnelInput = 64

// tunnel is one TCP connection to a port a session listens on, as an
// attachment: what the port sends goes up as frames under the id, each
// direction under the link's credit window (product/versions/mvp/28-session-previews.md).
// Up, the window is the same flowWindow a terminal's PTY pump reads under;
// down, the relay keeps it, and this side credits each frame the socket took.
type tunnel struct {
	id        uint32
	sessionID string
	conn      net.Conn
	cancel    context.CancelFunc
	// flow is the relay's credit for what this tunnel sent it.
	flow *flowWindow
	// input is the relay's bytes waiting for the socket.
	input chan []byte
	once  sync.Once
}

func (t *tunnel) credit(bytes int) { t.flow.credit(bytes) }

// close ends the connection; the pumps see it and stop.
func (t *tunnel) close() {
	t.once.Do(func() {
		t.cancel()
		t.flow.close()
		_ = t.conn.Close()
	})
}

// portList answers the session's listening ports.
func (h *linkHandler) portList(ctx context.Context, m link.PortList) {
	if h.ports == nil {
		h.fail(m.CommandID, portsdomain.ErrUnsupported)
		return
	}
	listeners, err := h.ports.List(ctx, m.SessionID)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	ports := make([]link.ListedPort, 0, len(listeners))
	for _, l := range listeners {
		if len(ports) == portListingMax {
			break
		}
		ports = append(ports, link.ListedPort{Port: l.Port, Process: truncate(l.Process, 100)})
	}
	_ = h.client.Send(link.PortListing{Type: link.TypePortListing, CommandID: m.CommandID, Ports: ports})
}

// portOpen dials one of the session's ports for the relay, and pumps it.
func (h *linkHandler) portOpen(m link.PortOpen, epoch uint64) {
	if h.ports == nil {
		h.forgetOpening(m.AttachmentID)
		h.fail(m.CommandID, portsdomain.ErrUnsupported)
		return
	}
	conn, _, err := h.ports.Open(h.life, m.SessionID, m.Port)
	if err != nil {
		h.forgetOpening(m.AttachmentID)
		h.fail(m.CommandID, err)
		return
	}
	ctx, cancel := context.WithCancel(h.life)
	t := &tunnel{
		id: m.AttachmentID, sessionID: m.SessionID, conn: conn, cancel: cancel,
		flow: newFlowWindow(), input: make(chan []byte, tunnelInput),
	}
	h.mu.Lock()
	cancelled := h.opening[t.id]
	delete(h.opening, t.id)
	if cancelled || !h.linkUp || h.epoch != epoch {
		h.mu.Unlock()
		t.close()
		return
	}
	h.tunnels[t.id] = t
	h.mu.Unlock()

	_ = h.client.Send(link.PortOpened{Type: link.TypePortOpened, AttachmentID: t.id})
	go h.tunnelUp(ctx, t)
	go h.tunnelDown(ctx, t)
}

// tunnelUp sends what the port says to the relay, a chunk at a time, while
// the relay has credit for it.
func (h *linkHandler) tunnelUp(ctx context.Context, t *tunnel) {
	buf := make([]byte, tunnelChunk)
	for t.flow.acquire(ctx) {
		n, err := t.conn.Read(buf)
		if n > 0 {
			if sendErr := h.client.SendFrame(ctx, t.id, buf[:n]); sendErr != nil {
				h.endTunnel(t, "link refused a frame")
				return
			}
			t.flow.sent(n)
		}
		if err != nil {
			reason := "port closed"
			if !errors.Is(err, io.EOF) && ctx.Err() == nil {
				reason = "port failed"
			}
			h.endTunnel(t, reason)
			return
		}
	}
}

// tunnelDown writes the relay's bytes to the port, crediting each frame
// once the socket took it.
func (h *linkHandler) tunnelDown(ctx context.Context, t *tunnel) {
	for {
		select {
		case <-ctx.Done():
			return
		case chunk := <-t.input:
			if _, err := t.conn.Write(chunk); err != nil {
				h.endTunnel(t, "port closed")
				return
			}
			_ = h.client.Send(link.AttachmentCredit{Type: "attachment.credit", AttachmentID: t.id, Bytes: len(chunk)})
		}
	}
}

// tunnelFrame queues the relay's bytes for the port. It runs on the read
// loop, so it never blocks: a relay that outran its window loses the tunnel.
func (h *linkHandler) tunnelFrame(t *tunnel, bytes []byte) {
	select {
	case t.input <- append([]byte(nil), bytes...):
	default:
		h.logger.Warn("port tunnel input over its window; closing it", slog.Uint64("attachment", uint64(t.id)))
		go h.endTunnel(t, "input over window")
	}
}

// endTunnel closes a tunnel the port's side ended, and tells the relay.
func (h *linkHandler) endTunnel(t *tunnel, reason string) {
	if !h.dropTunnel(t.id) {
		return
	}
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: t.id, Reason: reason})
}

// closePort is the relay hanging up a port attachment: an open tunnel
// closes, and one still being dialled is closed when its dial returns.
func (h *linkHandler) closePort(id uint32) {
	h.mu.Lock()
	if _, opening := h.opening[id]; opening {
		h.opening[id] = true
	}
	h.mu.Unlock()
	h.dropTunnel(id)
}

func (h *linkHandler) forgetOpening(id uint32) {
	h.mu.Lock()
	delete(h.opening, id)
	h.mu.Unlock()
}

// dropTunnel forgets and closes a tunnel, and reports whether it was open.
func (h *linkHandler) dropTunnel(id uint32) bool {
	h.mu.Lock()
	t, ok := h.tunnels[id]
	delete(h.tunnels, id)
	h.mu.Unlock()
	if ok {
		t.close()
	}
	return ok
}

func (h *linkHandler) tunnelByID(id uint32) *tunnel {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.tunnels[id]
}

// stopTunnels closes every tunnel: the link they ran on is gone.
func stopTunnels(open map[uint32]*tunnel) {
	for _, t := range open {
		t.close()
	}
}

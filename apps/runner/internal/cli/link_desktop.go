package cli

// `desktop.open`: the host's own screen for one browser
// (product/research/device-streaming.md, "A host's desktop"). The runner
// dials the screen-sharing server on the host's loopback, signs in with the
// credentials the host's owner gave `runner desktop on`, and then carries
// RFB both ways as a port tunnel does (link_ports.go), with a Viewer on the
// browser's side: it answers the browser's handshake itself, asking for no
// password, and drops the browser's input while it only watches.

import (
	"context"
	"log/slog"

	desktopdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// desktopOpen signs in to the host's screen-sharing server for the relay,
// and pumps it.
func (h *linkHandler) desktopOpen(m link.DesktopOpen, epoch uint64) {
	if h.desktop == nil {
		h.forgetOpening(m.AttachmentID)
		h.fail(m.CommandID, desktopdomain.ErrOff)
		return
	}
	conn, err := h.desktop.Open(h.life)
	if err != nil {
		h.forgetOpening(m.AttachmentID)
		h.fail(m.CommandID, err)
		return
	}
	ctx, cancel := context.WithCancel(h.life)
	t := &tunnel{
		id: m.AttachmentID, conn: conn, cancel: cancel,
		flow: newFlowWindow(), input: make(chan []byte, tunnelInput),
		viewer: desktopdomain.NewViewer(m.Control),
	}
	if !h.registerTunnel(t, epoch) {
		return
	}
	_ = h.client.Send(link.DesktopOpened{Type: link.TypeDesktopOpened, AttachmentID: t.id})
	// The browser reads the version first. The server says nothing more
	// until the browser's ClientInit reaches it, so this cannot interleave
	// with what tunnelUp reads.
	if !h.desktopSend(ctx, t, t.viewer.Greeting()) {
		return
	}
	go h.tunnelUp(ctx, t)
	go h.tunnelDown(ctx, t)
}

// desktopControl lets the browser click and type, or takes that away.
func (h *linkHandler) desktopControl(m link.DesktopControl) {
	if t := h.tunnelByID(m.AttachmentID); t != nil && t.viewer != nil {
		t.viewer.SetControl(m.Control)
	}
}

// desktopFeed runs what the browser sent through its Viewer: the
// handshake's answers go back to the browser, the rest on to the server.
// false is a stream that ended.
func (h *linkHandler) desktopFeed(ctx context.Context, t *tunnel, chunk []byte) ([]byte, bool) {
	answer, forward, err := t.viewer.Feed(chunk)
	if err != nil {
		h.logger.Warn("a browser broke RFB on the desktop; closing it",
			slog.Uint64("attachment", uint64(t.id)), slog.Any("error", err))
		h.endTunnel(t, "the browser broke RFB")
		return nil, false
	}
	if len(answer) > 0 && !h.desktopSend(ctx, t, answer) {
		return nil, false
	}
	return forward, true
}

// desktopSend sends the runner's own bytes to the browser: a few bytes of
// handshake, counted against the window the relay credits.
func (h *linkHandler) desktopSend(ctx context.Context, t *tunnel, bytes []byte) bool {
	if err := h.client.SendFrame(ctx, t.id, bytes); err != nil {
		h.endTunnel(t, "link refused a frame")
		return false
	}
	t.flow.sent(len(bytes))
	return true
}

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
	"time"

	desktopdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// desktopRecheck is how often an open desktop reads the host owner's choice
// again, so `runner desktop off` (another process) cuts off a desktop already
// streaming within it; a handler's own `desktopRecheck` overrides it.
const desktopRecheck = 2 * time.Second

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
	}
	viewer := &desktopViewer{h: h, t: t, viewer: desktopdomain.NewViewer(m.Control)}
	t.filter = viewer
	if !h.registerTunnel(t, epoch) {
		return
	}
	_ = h.client.Send(link.DesktopOpened{Type: link.TypeDesktopOpened, AttachmentID: t.id})
	// The browser reads the version first. The server says nothing more
	// until the browser's ClientInit reaches it, so this cannot interleave
	// with what tunnelUp reads.
	if !h.desktopSend(ctx, t, viewer.viewer.Greeting()) {
		return
	}
	go h.tunnelUp(ctx, t)
	go h.tunnelDown(ctx, t)
	go h.desktopWatch(ctx, t)
}

// desktopWatch ends a desktop once the host's owner stops sharing it. A
// settings file that cannot be read ends it too: sharing is what has to be
// shown, never assumed.
func (h *linkHandler) desktopWatch(ctx context.Context, t *tunnel) {
	every := h.desktopRecheck
	if every == 0 {
		every = desktopRecheck
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if settings, err := h.desktop.Settings(); err != nil || !settings.Enabled {
				h.endTunnel(t, "the host stopped sharing its desktop")
				return
			}
		}
	}
}

// desktopControl lets the browser click and type, or takes that away.
func (h *linkHandler) desktopControl(m link.DesktopControl) {
	if t := h.tunnelByID(m.AttachmentID); t != nil {
		if d, ok := t.filter.(*desktopViewer); ok {
			d.viewer.SetControl(m.Control)
		}
	}
}

// desktopViewer is a desktop tunnel's filter: the browser's half of RFB,
// which answers its handshake and drops its input while it only watches.
type desktopViewer struct {
	h      *linkHandler
	t      *tunnel
	viewer *desktopdomain.Viewer
}

// filter runs what the browser sent through the Viewer: the handshake's
// answers go back to the browser, the rest on to the server.
func (d *desktopViewer) filter(ctx context.Context, chunk []byte) ([]byte, bool) {
	answer, forward, err := d.viewer.Feed(chunk)
	if err != nil {
		d.h.logger.Warn("a browser broke RFB on the desktop; closing it",
			slog.Uint64("attachment", uint64(d.t.id)), slog.Any("error", err))
		d.h.endTunnel(d.t, "the browser broke RFB")
		return nil, false
	}
	if len(answer) > 0 && !d.h.desktopSend(ctx, d.t, answer) {
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

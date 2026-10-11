package cli

// The direct path's handler side (product/versions/mvp/22): the link
// forwards a browser's offer, this file answers it and tells the attachment's
// path (attachment_path.go) what happened. Which bytes go where is the
// path's; this file only translates between the link, the channel and it.
//
// A channel that closes sends the attachment back to the link, and tmux
// repaints the client's whole screen, which is what repairs whatever the
// channel did not deliver. The attachment itself stays open, so the terminal
// never sees a reconnect; the browser treats output arriving on the relay
// again as the same fallback.

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// directHeld bounds the channel input that may wait for the link to catch up
// to the browser's offset. Keystrokes are small; a browser that sends this
// much before its own offset arrives is not one worth waiting for.
const directHeld = 64 << 10

// offerTimeout bounds answering one offer, ICE gathering included.
const offerTimeout = 10 * time.Second

// sendOutput hands one PTY read to whichever path the attachment is on.
func (h *linkHandler) sendOutput(ctx context.Context, att *attachment, bytes []byte) error {
	if channel := att.path.output(bytes); channel != nil {
		return channel.Send(ctx, bytes)
	}
	return h.client.SendFrame(ctx, att.id, bytes)
}

// directOffer answers a browser's offer for an attachment this host holds.
// It runs off the read loop: gathering candidates takes up to seconds.
func (h *linkHandler) directOffer(m link.AttachmentDirectOffer) {
	refuse := func(reason string) {
		_ = h.client.Send(link.AttachmentDirectRefused{Type: link.TypeAttachmentDirectRefused, AttachmentID: m.AttachmentID, Reason: reason})
	}
	att := h.attachmentByID(m.AttachmentID)
	if att == nil {
		refuse("no such attachment on this host")
		return
	}
	if h.direct == nil {
		refuse("this host has no direct path")
		return
	}
	if !att.path.offer() {
		refuse("this attachment already has a direct path")
		return
	}
	ctx, cancel := context.WithTimeout(h.life, offerTimeout)
	defer cancel()
	answer, peer, err := h.direct.Answer(ctx, m.Sdp, m.IceServers, direct.Handlers{
		Open:    func(ch *direct.Channel) { h.directOpened(att, ch) },
		Message: func(bytes []byte) { h.directInput(att, bytes) },
		Closed:  func() { h.directClosed(att) },
	})
	if err != nil {
		reason := "the direct path could not be negotiated"
		if errors.Is(err, direct.ErrTooManyPeers) {
			reason = err.Error()
		}
		h.logger.Info("direct path refused", slog.String("attachment", att.String()), slog.Any("error", err))
		att.path.closed()
		refuse(reason)
		return
	}
	if !att.path.negotiated(peer) || h.attachmentByID(att.id) != att {
		// Detached while the answer was being gathered.
		peer.Close()
		return
	}
	_ = h.client.Send(link.AttachmentDirectAnswer{Type: link.TypeAttachmentDirectAnswer, AttachmentID: att.id, Sdp: answer})
}

// directOpened moves the attachment's output to ch and tells the browser
// after which byte.
func (h *linkHandler) directOpened(att *attachment, ch *direct.Channel) {
	offset, ok := att.path.opened(ch)
	if !ok || h.attachmentByID(att.id) != att {
		ch.Close()
		return
	}
	h.logger.Info("attachment moved to a direct path", slog.String("attachment", att.String()), slog.Uint64("offset", offset))
	_ = h.client.Send(link.AttachmentPath{Type: link.TypeAttachmentPath, AttachmentID: att.id, Offset: offset})
}

// directClosed puts the attachment back on the link when its channel goes
// away. If the channel had been carrying output, some of it may not have
// arrived: the client is asked to repaint, and the bytes that were in flight,
// which will never be credited, are forgotten.
func (h *linkHandler) directClosed(att *attachment) {
	if !att.path.closed() || h.attachmentByID(att.id) != att {
		return
	}
	h.logger.Info("direct path closed; attachment back on the link", slog.String("attachment", att.String()))
	att.flow.reset()
	if err := att.pty.Redraw(); err != nil {
		h.logger.Warn("could not ask the terminal to repaint after the direct path closed",
			slog.String("attachment", att.String()), slog.Any("error", err))
	}
}

// directInput is a keystroke frame from the channel.
func (h *linkHandler) directInput(att *attachment, bytes []byte) {
	if att.readOnly {
		// A watcher's input is dropped here on this path too, as Frame drops
		// it on the link; tmux holds the client read-only as well.
		return
	}
	frame := append([]byte(nil), bytes...)
	if !att.path.channelInput(frame, directHeld, h.inputQueue(att)) && h.release(att) {
		go h.closeAttachment(att, "direct input outran the relay")
	}
}

// directInputOffset records where the browser's input moved to the channel.
func (h *linkHandler) directInputOffset(m link.AttachmentPath) {
	if att := h.attachmentByID(m.AttachmentID); att != nil {
		att.path.inputMoved(m.Offset, h.inputQueue(att))
	}
}

// inputQueue is queueInput for one attachment, as the path calls it.
func (h *linkHandler) inputQueue(att *attachment) pathInput {
	return func(frame []byte) bool { return h.queueInput(att, frame) }
}

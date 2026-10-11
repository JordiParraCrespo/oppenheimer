package cli

// The direct path (product/versions/mvp/22): an attachment that starts on the
// link may move to a WebRTC data channel with its browser. The control plane
// forwards the browser's offer; this file answers it and moves the bytes.
//
// Each direction switches at a byte offset, never at a marker. Output: once
// the channel opens, every PTY byte after the ones already handed to the link
// goes on the channel, and `attachment.path` tells the browser how many came
// first — it reads the relay until it has them. Input: the browser counts the
// keystroke bytes it sent on the relay and says so (`attachment.path` from the
// control plane); channel input waits here until the link has delivered that
// many. Credit and resize stay on the link either way.
//
// A channel that closes takes its attachment with it: the browser reattaches
// on the relay, and tmux redraws the whole screen for the new client, which
// is what repairs anything the channel did not deliver.

import (
	"context"
	"errors"
	"log/slog"
	"sync"
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

// pathState is one attachment's direct path: which way its output goes and
// how far each direction's link stream has run.
type pathState struct {
	mu sync.Mutex
	// offered is set by the first offer; a second for the same attachment is
	// refused rather than racing the first.
	offered bool
	// peer is the negotiated channel, open or not, so closing the attachment
	// abandons a negotiation too.
	peer *direct.Channel
	// channel carries the output once it opens; nil is the link.
	channel *direct.Channel
	// outBytes is every PTY byte handed to the link. When the channel opens,
	// it is the output offset.
	outBytes uint64
	// inBytes is every keystroke byte the link delivered.
	inBytes uint64
	// inputOffset is where the browser's input moved to the channel; valid
	// once inputKnown is set.
	inputOffset uint64
	inputKnown  bool
	// held is channel input waiting for the link to reach inputOffset.
	held      [][]byte
	heldBytes int
}

// sendOutput hands one PTY read to whichever path the attachment is on. The
// count and the choice are taken together, under the path's lock, so a byte
// counted into the output offset is a byte that went to the link.
func (h *linkHandler) sendOutput(ctx context.Context, att *attachment, bytes []byte) error {
	att.path.mu.Lock()
	channel := att.path.channel
	if channel == nil {
		att.path.outBytes += uint64(len(bytes))
	}
	att.path.mu.Unlock()
	if channel != nil {
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
	att.path.mu.Lock()
	again := att.path.offered
	att.path.offered = true
	att.path.mu.Unlock()
	if again {
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
		refuse(reason)
		return
	}
	att.path.mu.Lock()
	att.path.peer = peer
	att.path.mu.Unlock()
	if h.attachmentByID(att.id) != att {
		// Detached while the answer was being gathered.
		peer.Close()
		return
	}
	_ = h.client.Send(link.AttachmentDirectAnswer{Type: link.TypeAttachmentDirectAnswer, AttachmentID: att.id, Sdp: answer})
}

// directOpened moves the attachment's output to ch and tells the browser
// after which byte.
func (h *linkHandler) directOpened(att *attachment, ch *direct.Channel) {
	if h.attachmentByID(att.id) != att {
		ch.Close()
		return
	}
	att.path.mu.Lock()
	att.path.channel = ch
	offset := att.path.outBytes
	att.path.mu.Unlock()
	h.logger.Info("attachment moved to a direct path", slog.String("attachment", att.String()), slog.Uint64("offset", offset))
	_ = h.client.Send(link.AttachmentPath{Type: link.TypeAttachmentPath, AttachmentID: att.id, Offset: offset})
}

// directClosed ends an attachment whose channel went away. Its browser
// reattaches on the relay, and the fresh tmux client redraws everything.
func (h *linkHandler) directClosed(att *attachment) {
	if h.release(att) {
		h.closeAttachment(att, "direct path closed")
	}
}

// linkInput is a keystroke frame from the link. It is queued with the count
// it advances, under the path's lock, and so is any channel input the count
// has now caught up to, after it: every queueing of input happens under that
// lock, which is what keeps the two paths' keystrokes in the order typed.
func (h *linkHandler) linkInput(att *attachment, frame []byte) {
	att.path.mu.Lock()
	defer att.path.mu.Unlock()
	att.path.inBytes += uint64(len(frame))
	if !h.queueInput(att, frame) {
		return
	}
	for _, held := range att.path.releaseHeld() {
		if !h.queueInput(att, held) {
			return
		}
	}
}

// releaseHeld returns the held channel input once the link has delivered
// everything the browser sent before switching. Called with mu held.
func (p *pathState) releaseHeld() [][]byte {
	if !p.inputKnown || p.inBytes < p.inputOffset || len(p.held) == 0 {
		return nil
	}
	held := p.held
	p.held, p.heldBytes = nil, 0
	return held
}

// directInput is a keystroke frame from the channel. It reaches the PTY only
// after every byte the browser sent on the relay before it.
func (h *linkHandler) directInput(att *attachment, bytes []byte) {
	if att.readOnly {
		// A watcher's input is dropped here on this path too, as Frame drops
		// it on the link; tmux holds the client read-only as well.
		return
	}
	frame := append([]byte(nil), bytes...)
	att.path.mu.Lock()
	defer att.path.mu.Unlock()
	if att.path.inputKnown && att.path.inBytes >= att.path.inputOffset && len(att.path.held) == 0 {
		h.queueInput(att, frame)
		return
	}
	if att.path.heldBytes+len(frame) > directHeld {
		if h.release(att) {
			go h.closeAttachment(att, "direct input outran the relay")
		}
		return
	}
	att.path.held = append(att.path.held, frame)
	att.path.heldBytes += len(frame)
}

// directInputOffset records where the browser's input moved to the channel.
func (h *linkHandler) directInputOffset(m link.AttachmentPath) {
	att := h.attachmentByID(m.AttachmentID)
	if att == nil {
		return
	}
	att.path.mu.Lock()
	defer att.path.mu.Unlock()
	att.path.inputOffset, att.path.inputKnown = m.Offset, true
	for _, held := range att.path.releaseHeld() {
		if !h.queueInput(att, held) {
			return
		}
	}
}

// closeDirect ends the attachment's channel, open or still negotiating.
func (att *attachment) closeDirect() {
	att.path.mu.Lock()
	peer := att.path.peer
	att.path.peer, att.path.channel = nil, nil
	att.path.mu.Unlock()
	if peer != nil {
		peer.Close()
	}
}

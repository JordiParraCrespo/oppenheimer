package cli

import (
	"context"
	"sync"
)

// The path an attachment's bytes take: the link, or a direct data channel to
// its browser (product/versions/mvp/22). attachmentPath owns every rule about
// it, under one lock, so the link handler only hands it bytes and events:
//
//	onLink ──offer──▶ negotiating ──opened──▶ onChannel
//	                       │                      │
//	                       └──────closed──────────┴──▶ fellBack (final)
//
// Output switches when the channel opens, after the bytes already handed to
// the link; that count is the output offset the browser waits for. Input
// switches when the browser says how many keystroke bytes it sent on the
// relay: channel keystrokes are held until the link has delivered that many,
// so the PTY sees them in the order they were typed. A fallback is final:
// the attachment stays on the link, and late channel input is dropped.

type pathMode int

const (
	pathOnLink pathMode = iota
	pathNegotiating
	pathOnChannel
	pathFellBack
)

// pathChannel is the direct channel as the path uses it (*direct.Channel).
type pathChannel interface {
	Send(ctx context.Context, bytes []byte) error
	Close()
}

// pathInput hands one keystroke frame to the PTY's queue and reports whether
// it took it. The path calls it with its lock held, which is what orders the
// two paths' keystrokes; it must not block.
type pathInput func(frame []byte) bool

type attachmentPath struct {
	mu   sync.Mutex
	mode pathMode
	// peer is the negotiated channel, open or not, so closing the attachment
	// abandons a negotiation too.
	peer pathChannel
	// outBytes is every PTY byte handed to the link.
	outBytes uint64
	// inBytes is every keystroke byte the link delivered.
	inBytes uint64
	// inputOffset is where the browser's input moved to the channel; valid
	// once inputKnown.
	inputOffset uint64
	inputKnown  bool
	// held is channel input waiting for the link to reach inputOffset.
	held      [][]byte
	heldBytes int
}

// offer starts a negotiation, and reports whether this attachment may have
// one: only the first offer, on the link, may.
func (p *attachmentPath) offer() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.mode != pathOnLink {
		return false
	}
	p.mode = pathNegotiating
	return true
}

// negotiated keeps the peer an answer produced, and reports whether the path
// still wants it; one that ended meanwhile does not, and the caller closes it.
func (p *attachmentPath) negotiated(peer pathChannel) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.mode != pathNegotiating {
		return false
	}
	p.peer = peer
	return true
}

// opened moves the output to ch, and returns the output offset.
func (p *attachmentPath) opened(ch pathChannel) (uint64, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.mode != pathNegotiating {
		return 0, false
	}
	p.mode, p.peer = pathOnChannel, ch
	return p.outBytes, true
}

// closed records that the channel is gone. The attachment is on the link for
// good; carried says whether the channel had been carrying output, whose
// screen may now be missing bytes.
func (p *attachmentPath) closed() (carried bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	carried = p.mode == pathOnChannel
	p.mode = pathFellBack
	p.peer = nil
	p.held, p.heldBytes = nil, 0
	return carried
}

// output says where one PTY read goes: the channel, or nil for the link, in
// which case it is counted into the output offset. The count and the choice
// are taken together, so a counted byte is a byte that went to the link.
func (p *attachmentPath) output(bytes []byte) pathChannel {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.mode == pathOnChannel && p.peer != nil {
		return p.peer
	}
	p.outBytes += uint64(len(bytes))
	return nil
}

// linkInput is a keystroke frame from the link: queued with the count it
// advances, then any channel input that count has caught up to, after it.
func (p *attachmentPath) linkInput(frame []byte, queue pathInput) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.inBytes += uint64(len(frame))
	if queue(frame) {
		p.releaseHeld(queue)
	}
}

// channelInput is a keystroke frame from the channel. It is queued only after
// every byte the browser sent on the relay before switching; until then it
// waits, up to limit bytes. It reports false when it would exceed that: a
// browser whose offset never comes is not worth waiting for.
func (p *attachmentPath) channelInput(frame []byte, limit int, queue pathInput) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	switch {
	case p.mode == pathFellBack:
		return true
	case p.inputReached() && len(p.held) == 0:
		queue(frame)
		return true
	case p.heldBytes+len(frame) > limit:
		return false
	}
	p.held = append(p.held, frame)
	p.heldBytes += len(frame)
	return true
}

// inputMoved records where the browser's input moved to the channel, and
// queues whatever was held for it once the link has caught up.
func (p *attachmentPath) inputMoved(offset uint64, queue pathInput) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.mode == pathFellBack {
		return
	}
	p.inputOffset, p.inputKnown = offset, true
	p.releaseHeld(queue)
}

// close abandons the channel, open or still negotiating, with the attachment.
func (p *attachmentPath) close() {
	p.mu.Lock()
	peer := p.peer
	p.peer = nil
	p.mu.Unlock()
	if peer != nil {
		peer.Close()
	}
}

func (p *attachmentPath) inputReached() bool {
	return p.inputKnown && p.inBytes >= p.inputOffset
}

// releaseHeld queues the held channel input once the link has delivered
// everything before the browser's switch. Called with mu held.
func (p *attachmentPath) releaseHeld(queue pathInput) {
	if !p.inputReached() || len(p.held) == 0 {
		return
	}
	held := p.held
	p.held, p.heldBytes = nil, 0
	for _, frame := range held {
		if !queue(frame) {
			return
		}
	}
}

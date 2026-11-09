package domain

import (
	"encoding/binary"
	"errors"
	"fmt"
	"sync/atomic"
)

// ErrBrowser is a browser that broke RFB; its stream is closed.
var ErrBrowser = errors.New("the browser broke RFB")

// maxClientMessage bounds one message from the browser: a clipboard's text is
// the only one that grows, and a megabyte of it is not a paste.
const maxClientMessage = 1 << 20

type viewerPhase int

const (
	phaseVersion viewerPhase = iota
	phaseSecurity
	phaseClientInit
	phaseMessages
)

// Viewer is the browser's half of a desktop stream. The runner has signed in
// to the server already (SignIn), so towards the browser it plays the server
// for the handshake: RFB 3.8, one security type, None, and success. From
// ClientInit on it relays what the browser sends, one whole message at a
// time, so that while the reader only watches every key, pointer, clipboard,
// resize and power message is dropped here, on the host, whatever the
// console or the relay let through.
//
// Feed is called from one goroutine; SetControl from any.
type Viewer struct {
	control atomic.Bool
	phase   viewerPhase
	pending []byte
}

// NewViewer starts a browser's stream, in control or watching.
func NewViewer(control bool) *Viewer {
	v := &Viewer{}
	v.control.Store(control)
	return v
}

// Greeting is what the browser reads first: the version the runner speaks
// to it, whatever the server's was.
func (v *Viewer) Greeting() []byte { return []byte("RFB 003.008\n") }

// SetControl lets the browser click and type, or takes that away.
func (v *Viewer) SetControl(on bool) { v.control.Store(on) }

// Control is whether the browser may click and type now.
func (v *Viewer) Control() bool { return v.control.Load() }

// Feed takes bytes the browser sent. answer goes back to the browser (the
// runner's half of the handshake); forward goes on to the server. An error
// is a browser that broke RFB, and ends the stream.
func (v *Viewer) Feed(p []byte) (answer, forward []byte, err error) {
	v.pending = append(v.pending, p...)
	for {
		switch v.phase {
		case phaseVersion:
			if len(v.pending) < 12 {
				return answer, forward, nil
			}
			if string(v.pending[:8]) != "RFB 003." {
				return nil, nil, fmt.Errorf("%w: version %q", ErrBrowser, v.pending[:12])
			}
			v.consume(12)
			// One security type, None: the runner signed in already.
			answer = append(answer, 1, securityNone)
			v.phase = phaseSecurity
		case phaseSecurity:
			if len(v.pending) < 1 {
				return answer, forward, nil
			}
			if v.pending[0] != securityNone {
				return nil, nil, fmt.Errorf("%w: security type %d", ErrBrowser, v.pending[0])
			}
			v.consume(1)
			answer = append(answer, 0, 0, 0, 0)
			v.phase = phaseClientInit
		case phaseClientInit:
			if len(v.pending) < 1 {
				return answer, forward, nil
			}
			v.consume(1)
			// Always shared: a reader opening the desktop never disconnects
			// anyone else watching it, the agent's own tools included.
			forward = append(forward, 1)
			v.phase = phaseMessages
		case phaseMessages:
			if len(v.pending) == 0 {
				return answer, forward, nil
			}
			size, err := clientMessageSize(v.pending)
			if err != nil {
				return nil, nil, err
			}
			if size == 0 || len(v.pending) < size {
				if len(v.pending) > maxClientMessage {
					return nil, nil, fmt.Errorf("%w: a message past %d bytes", ErrBrowser, maxClientMessage)
				}
				return answer, forward, nil
			}
			if v.Control() || !isInput(v.pending) {
				forward = append(forward, v.pending[:size]...)
			}
			v.consume(size)
		}
	}
}

func (v *Viewer) consume(n int) {
	v.pending = append(v.pending[:0], v.pending[n:]...)
}

// clientMessageSize is the length of the client message at the start of p
// (RFC 6143 §7.5, and the extensions noVNC sends), or 0 while too little of
// it has arrived to tell.
func clientMessageSize(p []byte) (int, error) {
	need := func(n int) bool { return len(p) >= n }
	switch p[0] {
	case 0: // SetPixelFormat
		return 20, nil
	case 2: // SetEncodings
		if !need(4) {
			return 0, nil
		}
		return 4 + 4*int(binary.BigEndian.Uint16(p[2:4])), nil
	case 3: // FramebufferUpdateRequest
		return 10, nil
	case 4: // KeyEvent
		return 8, nil
	case 5: // PointerEvent; noVNC's extended buttons add a byte
		if !need(2) {
			return 0, nil
		}
		if p[1]&0x80 != 0 {
			return 7, nil
		}
		return 6, nil
	case 6: // ClientCutText; a negative length is the extended form
		if !need(8) {
			return 0, nil
		}
		// Widened before the sign is dropped: -MinInt32 is MinInt32 in 32 bits.
		length := int64(int32(binary.BigEndian.Uint32(p[4:8]))) //nolint:gosec // a signed length by definition
		if length < 0 {
			length = -length
		}
		if length > maxClientMessage {
			return 0, fmt.Errorf("%w: a clipboard of %d bytes", ErrBrowser, length)
		}
		return 8 + int(length), nil
	case 150: // EnableContinuousUpdates
		return 10, nil
	case 248: // ClientFence
		if !need(9) {
			return 0, nil
		}
		return 9 + int(p[8]), nil
	case 250: // XVP
		return 4, nil
	case 251: // SetDesktopSize
		if !need(7) {
			return 0, nil
		}
		return 8 + 16*int(p[6]), nil
	case 255: // QEMU: extended key event, or audio
		if !need(4) {
			return 0, nil
		}
		switch p[1] {
		case 0:
			return 12, nil
		case 1:
			if binary.BigEndian.Uint16(p[2:4]) == 2 {
				return 10, nil
			}
			return 4, nil
		}
		return 0, fmt.Errorf("%w: QEMU message %d", ErrBrowser, p[1])
	default:
		return 0, fmt.Errorf("%w: message type %d", ErrBrowser, p[0])
	}
}

// isInput is whether the message at the start of p acts on the desktop
// rather than asks to see it: what a reader who only watches may not send.
func isInput(p []byte) bool {
	switch p[0] {
	case 4, 5, 6, 250, 251:
		return true
	case 255:
		return p[1] == 0
	default:
		return false
	}
}

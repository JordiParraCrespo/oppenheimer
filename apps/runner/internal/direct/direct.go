// Package direct is the direct terminal path (product/versions/mvp/22): a
// WebRTC data channel between a browser and this host for one attachment, so
// its bytes stop crossing the relay. The control plane signals it over the
// link; this package only answers an offer and carries bytes. Which bytes go
// where, and when, is the link handler's (internal/cli).
//
// It is a transport, like internal/link, not a bounded context: it knows
// nothing of sessions, tmux or the link.
package direct

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

// ChannelLabel is the data channel the browser opens for an attachment.
// Binary messages only: PTY output one way, keystrokes the other.
const ChannelLabel = "pty"

// Defaults for Options.
const (
	defaultMaxPeers      = 8
	defaultGatherTimeout = 3 * time.Second
	// A channel whose browser has not finished the host proof by then is
	// closed: nothing it sends before is a keystroke.
	defaultHandshakeTimeout = 5 * time.Second
	// A data channel holding this much unsent is a slow reader: Send waits
	// until it drains to bufferLow, which pauses the PTY read the way the
	// link's per-attachment queue does.
	bufferHigh = 1 << 20
	bufferLow  = 256 << 10
)

var (
	// ErrTooManyPeers is a host already serving its cap of direct readers;
	// the browser stays on the relay.
	ErrTooManyPeers = errors.New("too many direct peers on this host")
	// ErrClosed is a send on a channel that has closed.
	ErrClosed = errors.New("direct channel closed")
	// ErrNoProver is an Answerer built without a way to sign the host proof;
	// it answers nothing, since a browser would refuse its channel anyway.
	ErrNoProver = errors.New("direct: no host key to prove this host with")
	// ErrNoFingerprint is an offer with no DTLS fingerprint to bind to.
	ErrNoFingerprint = errors.New("direct: the offer names no DTLS fingerprint")
)

// Options configures an Answerer.
type Options struct {
	// MaxPeers caps the data channels open at once (22, "Several browsers").
	MaxPeers int
	// GatherTimeout bounds how long the answer waits for ICE candidates. The
	// answer carries every candidate (no trickle), so a STUN server that does
	// not answer must not hold the offer forever.
	GatherTimeout time.Duration
	// HandshakeTimeout bounds the host proof once the channel is open.
	HandshakeTimeout time.Duration
	// Prove signs the host proof (handshake.go) with the host key. Required:
	// without it every offer is refused.
	Prove  Prover
	Logger *slog.Logger
}

// Handlers are a channel's events. Open is called once the channel can carry
// bytes, which is after the browser has accepted the host proof, never at the
// data channel's own open; Message for every binary message from the browser
// after that; Closed once, when the channel or its peer connection ends,
// whichever is first.
type Handlers struct {
	Open    func(*Channel)
	Message func([]byte)
	Closed  func()
}

// Answerer answers browsers' offers, one peer connection per attachment.
type Answerer struct {
	opts  Options
	mu    sync.Mutex
	peers int
}

// NewAnswerer builds an Answerer.
func NewAnswerer(opts Options) *Answerer {
	if opts.MaxPeers <= 0 {
		opts.MaxPeers = defaultMaxPeers
	}
	if opts.GatherTimeout <= 0 {
		opts.GatherTimeout = defaultGatherTimeout
	}
	if opts.HandshakeTimeout <= 0 {
		opts.HandshakeTimeout = defaultHandshakeTimeout
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	return &Answerer{opts: opts}
}

// Answer takes a browser's offer and returns the answer SDP, with every local
// candidate in it, and the Channel it will open. The peer connection lives
// until the Channel is closed or its connection fails; h.Closed is called
// either way, and the peer's slot under MaxPeers is given back. Closing the
// Channel before it opens is how a caller abandons a negotiation.
func (a *Answerer) Answer(ctx context.Context, offer string, iceServers []string, h Handlers) (string, *Channel, error) {
	if a.opts.Prove == nil {
		return "", nil, ErrNoProver
	}
	offerFingerprints := Fingerprints(offer)
	if offerFingerprints == "" {
		return "", nil, ErrNoFingerprint
	}
	if !a.take() {
		return "", nil, ErrTooManyPeers
	}
	config := webrtc.Configuration{}
	if len(iceServers) > 0 {
		config.ICEServers = []webrtc.ICEServer{{URLs: iceServers}}
	}
	pc, err := webrtc.NewPeerConnection(config)
	if err != nil {
		a.give()
		return "", nil, fmt.Errorf("direct: peer connection: %w", err)
	}
	ch := &Channel{
		pc: pc, low: make(chan struct{}, 1), done: make(chan struct{}),
		hs: &handshake{prove: a.opts.Prove, offer: offerFingerprints},
	}
	var once sync.Once
	ch.end = func() {
		first := false
		once.Do(func() {
			first = true
			close(ch.done)
			a.give()
		})
		if !first {
			return
		}
		// Outside the Once: Closed may close the Channel again (the caller
		// tearing down what owns it), and pion's own close fires the state
		// callbacks that call end. Both must find it already done, not wait
		// on themselves.
		go func() { _ = pc.Close() }()
		if h.Closed != nil {
			h.Closed()
		}
	}

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		switch state {
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed, webrtc.PeerConnectionStateDisconnected:
			ch.end()
		}
	})
	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		if dc.Label() != ChannelLabel || !dc.Ordered() {
			// Only the one reliable, ordered channel carries a terminal.
			_ = dc.Close()
			return
		}
		ch.mu.Lock()
		ch.dc = dc
		ch.mu.Unlock()
		dc.SetBufferedAmountLowThreshold(bufferLow)
		dc.OnBufferedAmountLow(func() {
			select {
			case ch.low <- struct{}{}:
			default:
			}
		})
		dc.OnOpen(func() {
			// The proof comes first; a browser that never finishes it holds
			// a peer slot for this long and no longer.
			timer := time.AfterFunc(a.opts.HandshakeTimeout, func() {
				if !ch.isReady() {
					a.opts.Logger.Info("direct: the browser did not finish the host proof in time")
					ch.end()
				}
			})
			go func() {
				<-ch.done
				timer.Stop()
			}()
		})
		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			if !msg.IsString {
				if !ch.isReady() {
					// Bytes before the proof was accepted are not the
					// browser's: the handshake is the first thing it sends.
					ch.end()
					return
				}
				if h.Message != nil {
					h.Message(msg.Data)
				}
				return
			}
			if ch.isReady() {
				return
			}
			ch.mu.Lock()
			reply, done, err := ch.hs.receive(msg.Data)
			ch.mu.Unlock()
			if err != nil {
				a.opts.Logger.Info("direct: host proof refused", slog.Any("error", err))
				ch.end()
				return
			}
			if reply != nil {
				if err := dc.SendText(string(reply)); err != nil {
					ch.end()
				}
				return
			}
			if done {
				ch.mu.Lock()
				ch.ready = true
				ch.mu.Unlock()
				if h.Open != nil {
					h.Open(ch)
				}
			}
		})
		dc.OnClose(ch.end)
	})

	answer, err := a.negotiate(ctx, pc, offer)
	if err != nil {
		ch.end()
		return "", nil, err
	}
	answerFingerprints := Fingerprints(answer)
	if answerFingerprints == "" {
		ch.end()
		return "", nil, errors.New("direct: the answer names no DTLS fingerprint")
	}
	// Set before the answer leaves: the browser cannot open the channel, and
	// so cannot send hello, until it has the answer.
	ch.mu.Lock()
	ch.hs.answer = answerFingerprints
	ch.mu.Unlock()
	return answer, ch, nil
}

func (a *Answerer) negotiate(ctx context.Context, pc *webrtc.PeerConnection, offer string) (string, error) {
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offer}); err != nil {
		return "", fmt.Errorf("direct: offer: %w", err)
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("direct: answer: %w", err)
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("direct: local description: %w", err)
	}
	timer := time.NewTimer(a.opts.GatherTimeout)
	defer timer.Stop()
	select {
	case <-gathered:
	case <-timer.C:
		// What was gathered so far still answers: host candidates come first,
		// and they are the ones a reader on the same network needs.
		a.opts.Logger.Debug("direct: ICE gathering timed out; answering with what was gathered")
	case <-ctx.Done():
		return "", ctx.Err()
	}
	local := pc.LocalDescription()
	if local == nil {
		return "", errors.New("direct: no local description")
	}
	return local.SDP, nil
}

func (a *Answerer) take() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.peers >= a.opts.MaxPeers {
		return false
	}
	a.peers++
	return true
}

func (a *Answerer) give() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.peers > 0 {
		a.peers--
	}
}

// Peers is how many direct channels are open or being negotiated.
func (a *Answerer) Peers() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.peers
}

// Channel is one attachment's data channel.
type Channel struct {
	pc   *webrtc.PeerConnection
	mu   sync.Mutex
	dc   *webrtc.DataChannel
	low  chan struct{}
	done chan struct{}
	end  func()
	// hs is the host proof's state; ready once the browser accepted it.
	hs    *handshake
	ready bool
}

func (c *Channel) isReady() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ready
}

// Send writes bytes to the browser. It waits while the channel holds more
// than its high-water mark unsent, so a slow reader stalls this attachment's
// PTY reads rather than this process's memory. bytes may be reused once it
// returns.
func (c *Channel) Send(ctx context.Context, bytes []byte) error {
	c.mu.Lock()
	dc, ready := c.dc, c.ready
	c.mu.Unlock()
	if dc == nil || !ready {
		return ErrClosed
	}
	for dc.BufferedAmount() > bufferHigh {
		select {
		case <-c.low:
		case <-c.done:
			return ErrClosed
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	select {
	case <-c.done:
		return ErrClosed
	default:
	}
	if err := dc.Send(append([]byte(nil), bytes...)); err != nil {
		return fmt.Errorf("direct: send: %w", err)
	}
	return nil
}

// Close ends the channel and its peer connection. Safe to call more than once.
func (c *Channel) Close() {
	c.end()
}

// Package directtest is the console's side of the direct path for tests: a
// pion peer that offers the way the browser does and runs the browser's half
// of the host proof (product/versions/mvp/31). Like net/http/httptest, it is
// imported by tests only.
package directtest

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"sync"
	"testing"

	"github.com/pion/webrtc/v4"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
)

// NewProver is a host key and the Prover that signs with it.
func NewProver(t testing.TB) (direct.Prover, ed25519.PublicKey) {
	t.Helper()
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return func(transcript []byte) ([]byte, []byte, error) {
		return pub, ed25519.Sign(key, transcript), nil
	}, pub
}

// Browser is the offering peer. It sends hello when its channel opens,
// checks the proof against the fingerprints its own peer connection used,
// and says ready only for a valid one.
type Browser struct {
	PC *webrtc.PeerConnection
	DC *webrtc.DataChannel
	// Open is closed when the channel opens; Proved when a valid proof came;
	// Refused when the proof was missing its mark or did not verify.
	Open, Proved, Refused chan struct{}
	// Got receives a signal for every binary message.
	Got chan struct{}
	// Silent leaves hello unsent, a browser that never runs the handshake.
	Silent bool

	mu       sync.Mutex
	nonce    string
	key      ed25519.PublicKey
	received []byte
}

// NewBrowser creates the peer and its channel and returns the offer, every
// candidate gathered.
func NewBrowser(t testing.TB, label string) (*Browser, string) {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	dc, err := pc.CreateDataChannel(label, nil)
	if err != nil {
		t.Fatal(err)
	}
	b := &Browser{
		PC: pc, DC: dc,
		Open: make(chan struct{}), Proved: make(chan struct{}), Refused: make(chan struct{}),
		Got: make(chan struct{}, 64),
	}
	dc.OnOpen(func() {
		close(b.Open)
		if !b.Silent {
			b.hello()
		}
	})
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		if msg.IsString {
			b.proof(msg.Data)
			return
		}
		b.mu.Lock()
		b.received = append(b.received, msg.Data...)
		b.mu.Unlock()
		b.Got <- struct{}{}
	})
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	<-gathered
	return b, pc.LocalDescription().SDP
}

// Accept applies the host's answer.
func (b *Browser) Accept(t testing.TB, answer string) {
	t.Helper()
	if err := b.PC.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer}); err != nil {
		t.Fatal(err)
	}
}

// Bytes is every binary byte received.
func (b *Browser) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]byte(nil), b.received...)
}

// Key is the host key a valid proof carried; nil before one.
func (b *Browser) Key() ed25519.PublicKey {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.key
}

// SendText sends a raw text message, for a browser speaking out of turn.
func (b *Browser) SendText(text string) error { return b.DC.SendText(text) }

func (b *Browser) hello() {
	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	nonce := base64.RawURLEncoding.EncodeToString(raw)
	b.mu.Lock()
	b.nonce = nonce
	b.mu.Unlock()
	msg, _ := json.Marshal(map[string]any{"t": "hello", "v": direct.ProofVersion, "nonce": nonce})
	_ = b.DC.SendText(string(msg))
}

func (b *Browser) proof(raw []byte) {
	var m struct {
		T, Key, Sig string
		V           int
	}
	refuse := func() { close(b.Refused); _ = b.PC.Close() }
	if json.Unmarshal(raw, &m) != nil || m.T != "proof" || m.V != direct.ProofVersion {
		refuse()
		return
	}
	key, kerr := base64.RawURLEncoding.DecodeString(m.Key)
	sig, serr := base64.RawURLEncoding.DecodeString(m.Sig)
	if kerr != nil || serr != nil || len(key) != ed25519.PublicKeySize {
		refuse()
		return
	}
	b.mu.Lock()
	nonce := b.nonce
	b.mu.Unlock()
	transcript := direct.Transcript(
		direct.Fingerprints(b.PC.LocalDescription().SDP),
		direct.Fingerprints(b.PC.RemoteDescription().SDP),
		nonce,
	)
	if !ed25519.Verify(key, transcript, sig) {
		refuse()
		return
	}
	b.mu.Lock()
	b.key = key
	b.mu.Unlock()
	close(b.Proved)
	ready, _ := json.Marshal(map[string]any{"t": "ready", "v": direct.ProofVersion})
	_ = b.DC.SendText(string(ready))
}

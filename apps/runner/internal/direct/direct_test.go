package direct_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"errors"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct/directtest"
)

func newAnswerer(t *testing.T, opts direct.Options) (*direct.Answerer, ed25519.PublicKey) {
	t.Helper()
	prove, pub := directtest.NewProver(t)
	opts.Prove = prove
	return direct.NewAnswerer(opts), pub
}

func within(t *testing.T, what string, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(10 * time.Second):
		t.Fatalf("timed out waiting for %s", what)
	}
}

// A browser's offer is answered and the one channel carries bytes both ways:
// output from the host, keystrokes from the browser.
func TestAnswerCarriesBytesBothWays(t *testing.T) {
	answerer, hostKey := newAnswerer(t, direct.Options{})
	b, offer := directtest.NewBrowser(t, direct.ChannelLabel)

	opened := make(chan *direct.Channel, 1)
	input := make(chan []byte, 8)
	answer, peer, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{
		Open:    func(ch *direct.Channel) { opened <- ch },
		Message: func(p []byte) { input <- append([]byte(nil), p...) },
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	b.Accept(t, answer)

	var ch *direct.Channel
	select {
	case ch = <-opened:
	case <-time.After(10 * time.Second):
		t.Fatal("the channel never opened")
	}
	within(t, "the browser's side to open", b.Open)
	within(t, "the host proof", b.Proved)
	if !b.Key().Equal(hostKey) {
		t.Fatal("the proof carried a key that is not the host's")
	}

	if err := ch.Send(context.Background(), []byte("hello from tmux")); err != nil {
		t.Fatal(err)
	}
	within(t, "output to reach the browser", b.Got)
	if got := b.Bytes(); !bytes.Equal(got, []byte("hello from tmux")) {
		t.Fatalf("browser got %q", got)
	}

	if err := b.DC.Send([]byte("ls\r")); err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-input:
		if string(got) != "ls\r" {
			t.Fatalf("host got %q", got)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("keystrokes never reached the host")
	}
}

// The cap is per host: an offer past it is refused, and a closed channel
// gives its slot back.
func TestAnswerRefusesPastThePeerCap(t *testing.T) {
	prove, _ := directtest.NewProver(t)
	answerer := direct.NewAnswerer(direct.Options{MaxPeers: 1, Prove: prove})
	_, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	_, first, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{})
	if err != nil {
		t.Fatal(err)
	}
	_, second := directtest.NewBrowser(t, direct.ChannelLabel)
	if _, _, err := answerer.Answer(context.Background(), second, nil, direct.Handlers{}); !errors.Is(err, direct.ErrTooManyPeers) {
		t.Fatalf("second offer: %v, want ErrTooManyPeers", err)
	}
	first.Close()
	if answerer.Peers() != 0 {
		t.Fatalf("a closed channel kept its slot: %d peers", answerer.Peers())
	}
	_, third := directtest.NewBrowser(t, direct.ChannelLabel)
	_, peer, err := answerer.Answer(context.Background(), third, nil, direct.Handlers{})
	if err != nil {
		t.Fatalf("an offer after a slot was freed: %v", err)
	}
	peer.Close()
}

// Closed is called once however the channel ends, including from inside
// Closed itself (the owner tearing down what holds it), and a send after the
// end fails rather than blocking.
func TestCloseIsOnceAndReentrant(t *testing.T) {
	answerer, _ := newAnswerer(t, direct.Options{})
	_, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	var calls int
	var peer *direct.Channel
	done := make(chan struct{})
	_, peer, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{
		Closed: func() {
			calls++
			peer.Close()
			close(done)
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	peer.Close()
	within(t, "Closed", done)
	peer.Close()
	if calls != 1 {
		t.Fatalf("Closed ran %d times", calls)
	}
	if err := peer.Send(context.Background(), []byte("x")); !errors.Is(err, direct.ErrClosed) {
		t.Fatalf("send after close: %v", err)
	}
}

// Only the ordered channel named for a terminal carries one: anything else
// the offer opens never reaches the handler.
func TestAnswerIgnoresOtherChannels(t *testing.T) {
	answerer, _ := newAnswerer(t, direct.Options{})
	b, offer := directtest.NewBrowser(t, "something-else")
	opened := make(chan struct{}, 1)
	answer, peer, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{
		Open: func(*direct.Channel) { opened <- struct{}{} },
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	b.Accept(t, answer)
	select {
	case <-opened:
		t.Fatal("a channel that is not the terminal's was opened")
	case <-time.After(2 * time.Second):
	}
}

// openUnproved answers a browser's offer and returns what the host calls on
// it, for the proof's failure cases.
func openUnproved(t *testing.T, opts direct.Options, b *directtest.Browser, offer string) (opened, closed chan struct{}, input chan []byte) {
	t.Helper()
	answerer, _ := newAnswerer(t, opts)
	opened, closed, input = make(chan struct{}, 1), make(chan struct{}), make(chan []byte, 8)
	answer, peer, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{
		Open:    func(*direct.Channel) { opened <- struct{}{} },
		Message: func(p []byte) { input <- p },
		Closed:  func() { close(closed) },
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	b.Accept(t, answer)
	return opened, closed, input
}

// The attack the proof exists for: a control plane that answers the
// browser's offer itself and makes its own offer to the host, splicing two
// DTLS sessions and relaying between them. Every message reaches each end,
// the host signs honestly, and the browser still refuses: the host's
// signature covers the man in the middle's fingerprints, not the ones the
// browser's own peer connection used. The host never opens the channel.
func TestAManInTheMiddleIsRefusedByTheBrowser(t *testing.T) {
	b, browserOffer := directtest.NewBrowser(t, direct.ChannelLabel)

	// The middle's face to the host: a browser of its own, that says nothing
	// itself and relays whatever the real browser says.
	toHost, middleOffer := directtest.NewBrowser(t, direct.ChannelLabel)
	toHost.Silent = true
	answerer, _ := newAnswerer(t, direct.Options{})
	opened := make(chan struct{}, 1)
	hostAnswer, peer, err := answerer.Answer(context.Background(), middleOffer, nil, direct.Handlers{
		Open: func(*direct.Channel) { opened <- struct{}{} },
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	toHost.Accept(t, hostAnswer)

	// The middle's face to the browser: a peer that answers the browser's
	// offer with its own certificate.
	toBrowser, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = toBrowser.Close() })
	toBrowser.OnDataChannel(func(dc *webrtc.DataChannel) {
		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			<-toHost.Open
			_ = toHost.DC.SendText(string(msg.Data))
		})
		toHost.DC.OnMessage(func(msg webrtc.DataChannelMessage) {
			_ = dc.SendText(string(msg.Data))
		})
	})
	if err := toBrowser.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: browserOffer}); err != nil {
		t.Fatal(err)
	}
	answer, err := toBrowser.CreateAnswer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(toBrowser)
	if err := toBrowser.SetLocalDescription(answer); err != nil {
		t.Fatal(err)
	}
	<-gathered
	b.Accept(t, toBrowser.LocalDescription().SDP)

	within(t, "the browser to refuse the relayed proof", b.Refused)
	select {
	case <-b.Proved:
		t.Fatal("the browser accepted a proof through a man in the middle")
	case <-opened:
		t.Fatal("the host opened a channel to a man in the middle")
	case <-time.After(500 * time.Millisecond):
	}
}

// A browser that never runs the handshake gets no channel: it is closed when
// the proof's time is up, and its slot given back.
func TestABrowserThatNeverSaysHelloIsClosed(t *testing.T) {
	b, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	b.Silent = true
	opened, closed, _ := openUnproved(t, direct.Options{HandshakeTimeout: 300 * time.Millisecond}, b, offer)
	within(t, "the channel to close", closed)
	select {
	case <-opened:
		t.Fatal("a channel opened without a handshake")
	default:
	}
}

// Bytes before ready are not keystrokes: the host closes the channel rather
// than hand them to the PTY.
func TestBytesBeforeTheProofCloseTheChannel(t *testing.T) {
	b, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	b.Silent = true
	_, closed, input := openUnproved(t, direct.Options{}, b, offer)
	within(t, "the browser's side to open", b.Open)
	if err := b.DC.Send([]byte("rm -rf ~\r")); err != nil {
		t.Fatal(err)
	}
	within(t, "the channel to close", closed)
	select {
	case got := <-input:
		t.Fatalf("bytes before the proof reached the handler: %q", got)
	default:
	}
}

// A browser speaking out of turn (ready before hello) is closed.
func TestReadyBeforeHelloClosesTheChannel(t *testing.T) {
	b, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	b.Silent = true
	opened, closed, _ := openUnproved(t, direct.Options{}, b, offer)
	within(t, "the browser's side to open", b.Open)
	if err := b.SendText(`{"t":"ready","v":1}`); err != nil {
		t.Fatal(err)
	}
	within(t, "the channel to close", closed)
	select {
	case <-opened:
		t.Fatal("ready before hello opened the channel")
	default:
	}
}

// Without a host key the host answers nothing.
func TestAnAnswererWithoutAProverRefuses(t *testing.T) {
	_, offer := directtest.NewBrowser(t, direct.ChannelLabel)
	if _, _, err := direct.NewAnswerer(direct.Options{}).Answer(context.Background(), offer, nil, direct.Handlers{}); !errors.Is(err, direct.ErrNoProver) {
		t.Fatalf("answer without a prover: %v, want ErrNoProver", err)
	}
}

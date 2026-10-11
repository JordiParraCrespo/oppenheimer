package direct_test

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
)

// browser is the offering side, standing in for the console: it creates the
// channel, as the console does, and offers with every candidate gathered.
type browser struct {
	pc       *webrtc.PeerConnection
	dc       *webrtc.DataChannel
	open     chan struct{}
	mu       sync.Mutex
	received []byte
	got      chan struct{}
}

func newBrowser(t *testing.T, label string) (*browser, string) {
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
	b := &browser{pc: pc, dc: dc, open: make(chan struct{}), got: make(chan struct{}, 64)}
	dc.OnOpen(func() { close(b.open) })
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		b.mu.Lock()
		b.received = append(b.received, msg.Data...)
		b.mu.Unlock()
		b.got <- struct{}{}
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

func (b *browser) accept(t *testing.T, answer string) {
	t.Helper()
	if err := b.pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer}); err != nil {
		t.Fatal(err)
	}
}

func (b *browser) bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]byte(nil), b.received...)
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
	answerer := direct.NewAnswerer(direct.Options{})
	b, offer := newBrowser(t, direct.ChannelLabel)

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
	b.accept(t, answer)

	var ch *direct.Channel
	select {
	case ch = <-opened:
	case <-time.After(10 * time.Second):
		t.Fatal("the channel never opened")
	}
	within(t, "the browser's side to open", b.open)

	if err := ch.Send(context.Background(), []byte("hello from tmux")); err != nil {
		t.Fatal(err)
	}
	within(t, "output to reach the browser", b.got)
	if got := b.bytes(); !bytes.Equal(got, []byte("hello from tmux")) {
		t.Fatalf("browser got %q", got)
	}

	if err := b.dc.Send([]byte("ls\r")); err != nil {
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
	answerer := direct.NewAnswerer(direct.Options{MaxPeers: 1})
	_, offer := newBrowser(t, direct.ChannelLabel)
	_, first, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{})
	if err != nil {
		t.Fatal(err)
	}
	_, second := newBrowser(t, direct.ChannelLabel)
	if _, _, err := answerer.Answer(context.Background(), second, nil, direct.Handlers{}); !errors.Is(err, direct.ErrTooManyPeers) {
		t.Fatalf("second offer: %v, want ErrTooManyPeers", err)
	}
	first.Close()
	if answerer.Peers() != 0 {
		t.Fatalf("a closed channel kept its slot: %d peers", answerer.Peers())
	}
	_, third := newBrowser(t, direct.ChannelLabel)
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
	answerer := direct.NewAnswerer(direct.Options{})
	_, offer := newBrowser(t, direct.ChannelLabel)
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
	answerer := direct.NewAnswerer(direct.Options{})
	b, offer := newBrowser(t, "something-else")
	opened := make(chan struct{}, 1)
	answer, peer, err := answerer.Answer(context.Background(), offer, nil, direct.Handlers{
		Open: func(*direct.Channel) { opened <- struct{}{} },
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	b.accept(t, answer)
	select {
	case <-opened:
		t.Fatal("a channel that is not the terminal's was opened")
	case <-time.After(2 * time.Second):
	}
}

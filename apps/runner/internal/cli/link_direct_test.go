package cli

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

func writtenTo(p *heldPTY) string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return string(p.written)
}

func waitWritten(t *testing.T, p *heldPTY, want string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for writtenTo(p) != want {
		if time.Now().After(deadline) {
			t.Fatalf("the PTY got %q, want %q", writtenTo(p), want)
		}
		time.Sleep(time.Millisecond)
	}
}

func pathMessage(t *testing.T, offset int) link.Message {
	return message(t, "attachment.path", map[string]any{"attachmentId": attachmentUnderTest, "offset": offset})
}

// Keystrokes sent on the channel before the browser says where it switched
// wait for that offset, and then for the link to deliver everything before
// it: the PTY sees them in the order they were typed, whichever path was
// faster.
func TestDirectInputWaitsForTheRelayToCatchUp(t *testing.T) {
	pty := newHeldPTY(false)
	h, _, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	att := h.attachmentByID(attachmentUnderTest)

	// The channel overtakes: "c" arrives before the offset and before the
	// relay's "ab".
	h.directInput(att, []byte("c"))
	h.Message(context.Background(), pathMessage(t, 2))
	h.Frame(context.Background(), attachmentUnderTest, []byte("a"))
	time.Sleep(10 * time.Millisecond)
	if got := writtenTo(pty); got != "a" {
		t.Fatalf("the PTY got %q before the relay delivered the offset's bytes", got)
	}
	h.Frame(context.Background(), attachmentUnderTest, []byte("b"))
	h.directInput(att, []byte("d"))
	waitWritten(t, pty, "abcd")
}

// The same when the relay was ahead: the offset is already reached, so
// channel input goes straight to the PTY.
func TestDirectInputFlowsOnceTheOffsetIsReached(t *testing.T) {
	pty := newHeldPTY(false)
	h, _, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	att := h.attachmentByID(attachmentUnderTest)

	h.Frame(context.Background(), attachmentUnderTest, []byte("ls"))
	h.Message(context.Background(), pathMessage(t, 2))
	h.directInput(att, []byte("\r"))
	waitWritten(t, pty, "ls\r")
}

// A watcher's keystrokes are dropped on the channel as they are on the link.
func TestDirectInputOfAReadOnlyAttachmentIsDropped(t *testing.T) {
	pty := newHeldPTY(false)
	h, _, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), message(t, "session.attach", map[string]any{
		"commandId": "55555555-5555-4555-8555-555555555555", "sessionId": sessionUnderTest,
		"attachmentId": attachmentUnderTest, "window": 0, "cols": 80, "rows": 24, "readOnly": true,
	}))
	waitForAttachment(t, h)
	h.Message(context.Background(), pathMessage(t, 0))
	h.directInput(h.attachmentByID(attachmentUnderTest), []byte("rm -rf ~\r"))
	time.Sleep(20 * time.Millisecond)
	if got := writtenTo(pty); got != "" {
		t.Fatalf("a read-only attachment's PTY got %q", got)
	}
}

// Channel input that piles up while the browser's offset never comes is a
// browser not worth waiting for: the attachment closes, and its browser
// reattaches on the relay.
func TestDirectInputThatOutrunsTheRelayClosesTheAttachment(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	att := h.attachmentByID(attachmentUnderTest)
	chunk := make([]byte, 16<<10)
	for i := 0; i < 5; i++ {
		h.directInput(att, chunk)
	}
	sent.waitFor(t, "attachment.closed", func(m any) bool {
		c, ok := m.(link.AttachmentClosed)
		return ok && c.Reason == "direct input outran the relay"
	})
}

// browserPeer is the console's side of the channel, offering as it does.
type browserPeer struct {
	pc  *webrtc.PeerConnection
	dc  *webrtc.DataChannel
	mu  sync.Mutex
	got []byte
}

func offerFromBrowser(t *testing.T) (*browserPeer, string) {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	dc, err := pc.CreateDataChannel(direct.ChannelLabel, nil)
	if err != nil {
		t.Fatal(err)
	}
	b := &browserPeer{pc: pc, dc: dc}
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		b.mu.Lock()
		b.got = append(b.got, msg.Data...)
		b.mu.Unlock()
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

func (b *browserPeer) received() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return string(b.got)
}

// The whole switch over a real data channel: the offer is answered over the
// link, the channel opens, the host says after which output byte it moved,
// and output from then on reaches the browser on the channel. When the
// channel closes the attachment stays open, back on the link, and the client
// is asked to repaint what the channel may have lost.
func TestAnOfferMovesTheOutputToTheChannel(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, _ := newAttachHarness(t, pty, nil)
	h.direct = direct.NewAnswerer(direct.Options{})
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	att := h.attachmentByID(attachmentUnderTest)

	// Output before the switch went to the link and counts into the offset.
	if err := h.sendOutput(context.Background(), att, []byte("before")); err != nil {
		t.Fatal(err)
	}

	browser, offer := offerFromBrowser(t)
	h.Message(context.Background(), message(t, "attachment.direct.offer", map[string]any{
		"attachmentId": attachmentUnderTest, "sdp": offer, "iceServers": []string{},
	}))
	answer := sent.waitFor(t, "attachment.direct.answer", func(m any) bool {
		_, ok := m.(link.AttachmentDirectAnswer)
		return ok
	}).(link.AttachmentDirectAnswer)
	if err := browser.pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer.Sdp}); err != nil {
		t.Fatal(err)
	}

	path := sent.waitFor(t, "attachment.path", func(m any) bool {
		_, ok := m.(link.AttachmentPath)
		return ok
	}).(link.AttachmentPath)
	if path.Offset != uint64(len("before")) {
		t.Fatalf("output moved after byte %d, want %d", path.Offset, len("before"))
	}

	if err := h.sendOutput(context.Background(), att, []byte("after")); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for browser.received() != "after" {
		if time.Now().After(deadline) {
			t.Fatalf("the browser got %q on the channel, want only what followed the switch", browser.received())
		}
		time.Sleep(time.Millisecond)
	}

	if got := sent.framed(); got != "before" {
		t.Fatalf("the link carried %q, want only what preceded the switch", got)
	}

	_ = browser.pc.Close()
	deadline = time.Now().Add(10 * time.Second)
	for pty.redrawn() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the client was never asked to repaint after the channel closed")
		}
		time.Sleep(time.Millisecond)
	}
	if h.attachmentByID(attachmentUnderTest) != att {
		t.Fatal("the attachment did not survive its channel")
	}
	if err := h.sendOutput(context.Background(), att, []byte(" back")); err != nil {
		t.Fatal(err)
	}
	if got := sent.framed(); got != "before back" {
		t.Fatalf("after the fallback the link carried %q", got)
	}
	if h.direct.Peers() != 0 {
		t.Fatalf("the closed channel kept its slot: %d", h.direct.Peers())
	}
	// Late channel input after the fallback goes nowhere.
	h.Message(context.Background(), pathMessage(t, 0))
	h.directInput(att, []byte("late"))
	time.Sleep(10 * time.Millisecond)
	if got := writtenTo(pty); got != "" {
		t.Fatalf("channel input after the fallback reached the PTY: %q", got)
	}
}

// A second offer for an attachment that already has one is refused rather
// than raced, and so is an offer for an attachment that can no longer come:
// the link that would have opened it is gone.
func TestOffersThatCannotBeAnsweredAreRefused(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, _ := newAttachHarness(t, pty, nil)
	h.direct = direct.NewAnswerer(direct.Options{})

	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	_, offer := offerFromBrowser(t)
	for i := 0; i < 2; i++ {
		h.Message(context.Background(), message(t, "attachment.direct.offer", map[string]any{
			"attachmentId": attachmentUnderTest, "sdp": offer, "iceServers": []string{},
		}))
	}
	sent.waitFor(t, "a refusal of the second offer", func(m any) bool {
		r, ok := m.(link.AttachmentDirectRefused)
		return ok && r.AttachmentID == attachmentUnderTest
	})

	h.Disconnected(1)
	h.Message(context.Background(), message(t, "attachment.direct.offer", map[string]any{
		"attachmentId": 99, "sdp": "v=0", "iceServers": []string{},
	}))
	sent.waitFor(t, "a refusal for an attachment no link will open", func(m any) bool {
		r, ok := m.(link.AttachmentDirectRefused)
		return ok && r.AttachmentID == 99
	})
}

// The capability is offered exactly when the host can answer.
func TestTheHelloNamesTheDirectPathWhenTheHostCanAnswer(t *testing.T) {
	h := &linkHandler{}
	for _, named := range h.capabilities() {
		if named == link.CapabilityAttachmentDirect {
			t.Fatal("a host with no answerer offered the direct path")
		}
	}
	h.direct = direct.NewAnswerer(direct.Options{})
	found := false
	for _, named := range h.capabilities() {
		found = found || named == link.CapabilityAttachmentDirect
	}
	if !found {
		t.Fatal("a host that can answer did not offer the direct path")
	}
}

// The channel closing under a send is the path falling back, not the PTY
// ending: the read goes to the link, the pump would carry on, the client is
// repainted, and the attachment stays open. Ending it would reach the
// browser as the session gone.
func TestAChannelThatClosesUnderASendFallsBackToTheLink(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, _ := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), attachMessage(t))
	waitForAttachment(t, h)
	att := h.attachmentByID(attachmentUnderTest)
	closing := &fakeChannel{err: direct.ErrClosed}
	att.path.offer()
	att.path.negotiated(closing)
	att.path.opened(closing)

	if err := h.sendOutput(context.Background(), att, []byte("caught")); err != nil {
		t.Fatalf("a closed channel ended the pump: %v", err)
	}
	if got := sent.framed(); got != "caught" {
		t.Fatalf("the link carried %q, want the read the channel could not", got)
	}
	if pty.redrawn() != 1 {
		t.Fatalf("the client was repainted %d times, want once", pty.redrawn())
	}
	if h.attachmentByID(attachmentUnderTest) != att {
		t.Fatal("the attachment did not survive its channel")
	}
	if err := h.sendOutput(context.Background(), att, []byte(" next")); err != nil || sent.framed() != "caught next" {
		t.Fatalf("the next read did not stay on the link: %v, %q", err, sent.framed())
	}
}

// The relay tells the browser `attached` as it sends the attach, so a quick
// browser's offer can arrive while tmux is still opening the PTY. It waits
// for the attachment rather than refusing it for good.
func TestAnOfferWaitsForAnAttachmentStillOpening(t *testing.T) {
	pty := newHeldPTY(false)
	gate := make(chan struct{})
	h, sent, terminals := newAttachHarness(t, pty, gate)
	h.direct = direct.NewAnswerer(direct.Options{})
	h.Message(context.Background(), attachMessage(t))
	<-terminals.entered

	_, offer := offerFromBrowser(t)
	h.Message(context.Background(), message(t, "attachment.direct.offer", map[string]any{
		"attachmentId": attachmentUnderTest, "sdp": offer, "iceServers": []string{},
	}))
	time.Sleep(100 * time.Millisecond)
	close(gate)

	got := sent.waitFor(t, "an answer or a refusal", func(m any) bool {
		switch m.(type) {
		case link.AttachmentDirectAnswer, link.AttachmentDirectRefused:
			return true
		}
		return false
	})
	if refused, ok := got.(link.AttachmentDirectRefused); ok {
		t.Fatalf("the offer was refused while its attachment opened: %s", refused.Reason)
	}
}

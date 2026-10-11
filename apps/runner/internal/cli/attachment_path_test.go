package cli

import (
	"context"
	"testing"
)

type fakeChannel struct {
	closed int
	// err is what every Send returns: a channel that has closed.
	err error
}

func (c *fakeChannel) Send(context.Context, []byte) error { return c.err }
func (c *fakeChannel) Close()                             { c.closed++ }

// queued collects what the path hands the PTY, in order.
type queued struct{ frames []string }

func (q *queued) take(frame []byte) bool {
	q.frames = append(q.frames, string(frame))
	return true
}

func (q *queued) joined() string {
	out := ""
	for _, f := range q.frames {
		out += f
	}
	return out
}

// The transition table: one offer, output on the channel only once it opens,
// the offset being every byte the link carried before it.
func TestAPathMovesOutputAtTheOffsetItCounted(t *testing.T) {
	var p attachmentPath
	if p.output(make([]byte, 5)) != nil {
		t.Fatal("output went to a channel before any was offered")
	}
	if !p.offer() || p.offer() {
		t.Fatal("want exactly one offer per attachment")
	}
	ch := &fakeChannel{}
	if !p.negotiated(ch) {
		t.Fatal("a negotiating path refused its peer")
	}
	if p.output(make([]byte, 3)) != nil {
		t.Fatal("output went to the channel before it opened")
	}
	offset, ok := p.opened(ch)
	if !ok || offset != 8 {
		t.Fatalf("opened at %d (%v), want after the 8 bytes the link carried", offset, ok)
	}
	if p.output(make([]byte, 4)) != ch {
		t.Fatal("output after the switch did not go to the channel")
	}
}

// A fallback is final: output and input stay on the link, a later offer is
// refused, held channel input is dropped and late channel input goes nowhere.
func TestAFallbackIsFinal(t *testing.T) {
	var p attachmentPath
	var q queued
	p.offer()
	ch := &fakeChannel{}
	p.negotiated(ch)
	p.opened(ch)
	p.channelInput([]byte("held"), 1024, q.take)
	if carried := p.closed(); !carried {
		t.Fatal("a channel that carried output was not reported as such")
	}
	if p.output(make([]byte, 1)) != nil {
		t.Fatal("output went to a closed channel")
	}
	if p.offer() {
		t.Fatal("a path that fell back took a second offer")
	}
	p.inputMoved(0, q.take)
	p.channelInput([]byte("late"), 1024, q.take)
	p.linkInput([]byte("typed"), q.take)
	if got := q.joined(); got != "typed" {
		t.Fatalf("the PTY got %q after the fallback, want only the link's input", got)
	}
}

// A closed channel that never carried output needs no repaint.
func TestAChannelThatNeverOpenedCarriedNothing(t *testing.T) {
	var p attachmentPath
	p.offer()
	if p.closed() {
		t.Fatal("a channel that never opened was reported as having carried output")
	}
}

// A peer that arrives after the path ended is not kept: the caller closes it.
func TestAPeerAfterTheEndIsRefused(t *testing.T) {
	var p attachmentPath
	p.offer()
	p.closed()
	if p.negotiated(&fakeChannel{}) {
		t.Fatal("a path that ended took a peer")
	}
}

// Closing the attachment closes the peer, open or still negotiating.
func TestClosingThePathClosesItsPeer(t *testing.T) {
	var p attachmentPath
	p.offer()
	ch := &fakeChannel{}
	p.negotiated(ch)
	p.close()
	if ch.closed != 1 {
		t.Fatalf("the peer was closed %d times", ch.closed)
	}
}

// Channel input past the hold limit is refused rather than buffered.
func TestChannelInputPastTheLimitIsRefused(t *testing.T) {
	var p attachmentPath
	var q queued
	if !p.channelInput([]byte("abc"), 4, q.take) {
		t.Fatal("input within the limit was refused")
	}
	if p.channelInput([]byte("de"), 4, q.take) {
		t.Fatal("input past the limit was held")
	}
}

package link_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/coder/websocket"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// The control plane closes a link that sends a frame over MaxFrameBytes with
// 1009, so the runner refuses to queue one: the frame is the caller's error,
// and the link stays up for everything else.
func TestSendRefusesAFrameOverTheCapAndKeepsTheLink(t *testing.T) {
	cp := newControlPlane(t)
	c := client(t, cp, &recorder{}, "token")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)
	conn := <-cp.conns
	eventually(t, "link", c.Live)

	huge := link.CommandFailed{Type: "command.failed", CommandID: "c1", Code: "X", Detail: strings.Repeat("x", link.MaxFrameBytes)}
	if err := c.Send(huge); !errors.Is(err, link.ErrFrameTooLarge) {
		t.Fatalf("Send of an oversized control frame = %v, want ErrFrameTooLarge", err)
	}
	if err := c.SendFrame(ctx, 7, make([]byte, link.MaxFrameBytes)); !errors.Is(err, link.ErrFrameTooLarge) {
		t.Fatalf("SendFrame of an oversized PTY frame = %v, want ErrFrameTooLarge", err)
	}

	if err := c.Send(link.CommandFailed{Type: "command.failed", CommandID: "c2", Code: "X"}); err != nil {
		t.Fatal(err)
	}
	for {
		kind, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("the link went with the refused frame: %v", err)
		}
		if kind != websocket.MessageText || strings.Contains(string(data), `"heartbeat"`) {
			continue
		}
		if len(data) > link.MaxFrameBytes || !strings.Contains(string(data), `"c2"`) {
			t.Fatalf("the first control frame on the wire is %d bytes, want the small one", len(data))
		}
		return
	}
}

// The runner reads no bigger frame than it may send: one over the cap ends
// the link, which redials.
func TestALinkThatReceivesAFrameOverTheCapIsDropped(t *testing.T) {
	cp := newControlPlane(t)
	rec := &recorder{}
	c := client(t, cp, rec, "token")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)
	conn := <-cp.conns
	eventually(t, "link", c.Live)

	// Exactly the cap is a frame the protocol allows.
	if err := conn.Write(ctx, websocket.MessageBinary, link.EncodeFrame(7, make([]byte, link.MaxFrameBytes-link.FrameHeader))); err != nil {
		t.Fatal(err)
	}
	eventually(t, "the frame at the cap", func() bool { return rec.count(func(r *recorder) int { return len(r.frames) })() == 1 })

	// One byte more is not; the write may or may not see the close first.
	_ = conn.Write(ctx, websocket.MessageBinary, link.EncodeFrame(7, make([]byte, link.MaxFrameBytes-link.FrameHeader+1)))
	eventually(t, "the link dropped", func() bool { return rec.count(func(r *recorder) int { return len(r.disconnected) })() == 1 })
	<-cp.conns
	eventually(t, "redial", func() bool { return c.Epoch() == 2 })
}

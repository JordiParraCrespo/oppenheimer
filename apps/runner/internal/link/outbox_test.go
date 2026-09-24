package link

import (
	"context"
	"errors"
	"testing"
	"time"
)

func frameOf(id uint32, b byte) []byte { return []byte{0, byte(id), b} }

func TestOutboxSendsControlFirst(t *testing.T) {
	o := newOutbox()
	ctx := context.Background()
	if err := o.pushFrame(ctx, 1, frameOf(1, 'a')); err != nil {
		t.Fatal(err)
	}
	if err := o.pushControl([]byte{1, 'c'}); err != nil {
		t.Fatal(err)
	}
	first, _ := o.next(ctx)
	if first[0] != 1 {
		t.Fatalf("control frame should go first, got %v", first)
	}
}

// A pane printing a build log must not delay another pane's keystroke echo by
// more than one of its frames.
func TestOutboxTakesAttachmentsInTurn(t *testing.T) {
	o := newOutbox()
	ctx := context.Background()
	for i := range 5 {
		if err := o.pushFrame(ctx, 1, frameOf(1, byte('0'+i))); err != nil {
			t.Fatal(err)
		}
	}
	if err := o.pushFrame(ctx, 2, frameOf(2, 'e')); err != nil {
		t.Fatal(err)
	}
	var order []byte
	for range 6 {
		f, err := o.next(ctx)
		if err != nil {
			t.Fatal(err)
		}
		order = append(order, f[1])
	}
	if string(order) != "\x01\x02\x01\x01\x01\x01" {
		t.Fatalf("order = %v", order)
	}
}

func TestOutboxBlocksAFullAttachmentInsteadOfDropping(t *testing.T) {
	o := newOutbox()
	ctx := context.Background()
	for range attachmentQueue {
		if err := o.pushFrame(ctx, 1, frameOf(1, 'x')); err != nil {
			t.Fatal(err)
		}
	}
	done := make(chan error, 1)
	go func() { done <- o.pushFrame(ctx, 1, frameOf(1, 'y')) }()
	select {
	case err := <-done:
		t.Fatalf("a full queue should block, returned %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	// Another attachment is not held up by the full one.
	if err := o.pushFrame(ctx, 2, frameOf(2, 'z')); err != nil {
		t.Fatal(err)
	}
	if _, err := o.next(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("draining a frame should unblock the producer")
	}
}

func TestOutboxCloseReleasesBlockedProducers(t *testing.T) {
	o := newOutbox()
	ctx := context.Background()
	for range attachmentQueue {
		_ = o.pushFrame(ctx, 1, frameOf(1, 'x'))
	}
	done := make(chan error, 1)
	go func() { done <- o.pushFrame(ctx, 1, frameOf(1, 'y')) }()
	time.Sleep(20 * time.Millisecond)
	o.close()
	select {
	case err := <-done:
		if !errors.Is(err, errOutboxClosed) {
			t.Fatalf("got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("close should release the producer")
	}
	if err := o.pushControl([]byte{1}); !errors.Is(err, errOutboxClosed) {
		t.Fatalf("got %v", err)
	}
}

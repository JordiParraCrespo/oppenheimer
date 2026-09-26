package cli

import (
	"context"
	"testing"
	"time"
)

func TestFlowWindowPausesAtTheWindowAndResumesOnCredit(t *testing.T) {
	w := newFlowWindow()
	ctx := context.Background()
	if !w.acquire(ctx) {
		t.Fatal("a fresh window must admit a read")
	}
	w.sent(creditWindow)
	acquired := make(chan bool, 1)
	go func() { acquired <- w.acquire(ctx) }()
	select {
	case <-acquired:
		t.Fatal("a spent window must block the next read")
	case <-time.After(50 * time.Millisecond):
	}
	w.credit(1)
	select {
	case ok := <-acquired:
		if !ok {
			t.Fatal("credit must let the read proceed")
		}
	case <-time.After(time.Second):
		t.Fatal("credit did not wake the reader")
	}
}

func TestFlowWindowReleasesOnCloseAndOnContext(t *testing.T) {
	w := newFlowWindow()
	w.sent(creditWindow)
	done := make(chan bool, 1)
	go func() { done <- w.acquire(context.Background()) }()
	w.close()
	if ok := <-done; ok {
		t.Fatal("a closed window must answer false")
	}

	w2 := newFlowWindow()
	w2.sent(creditWindow)
	ctx, cancel := context.WithCancel(context.Background())
	go func() { done <- w2.acquire(ctx) }()
	cancel()
	if ok := <-done; ok {
		t.Fatal("a cancelled context must answer false")
	}
}

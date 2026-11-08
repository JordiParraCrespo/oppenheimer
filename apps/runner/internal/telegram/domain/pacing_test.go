package domain

import (
	"testing"
	"time"
)

// Two sends to one chat are a second apart, and a send that would wait past
// MaxWait is refused rather than held: Telegram's own limit, kept on the host.
func TestPacerSpacesSendsToAChat(t *testing.T) {
	p := NewPacer()
	now := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	if wait, ok := p.Reserve("123", now); !ok || wait != 0 {
		t.Fatalf("first send waits %s", wait)
	}
	if wait, ok := p.Reserve("123", now); !ok || wait != ChatInterval {
		t.Fatalf("second send waits %s", wait)
	}
	if wait, ok := p.Reserve("456", now); !ok || wait != 0 {
		t.Fatalf("another chat waits %s", wait)
	}
}

// A group takes twenty a minute; the twenty-first waits for the minute to
// free a slot, and is refused when that is past MaxWait.
func TestPacerHoldsAGroupToTwentyAMinute(t *testing.T) {
	p := NewPacer()
	now := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	for i := range GroupPerMinute {
		if _, ok := p.Reserve("-1001", now.Add(time.Duration(i)*ChatInterval)); !ok {
			t.Fatalf("send %d refused", i)
		}
	}
	if _, ok := p.Reserve("-1001", now.Add(GroupPerMinute*ChatInterval)); ok {
		t.Fatal("a twenty-first send in the minute was booked")
	}
}

// A 429's retry_after holds every chat.
func TestPacerPauseHoldsEveryChat(t *testing.T) {
	p := NewPacer()
	now := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	p.PauseUntil(now.Add(time.Minute))
	if _, ok := p.Reserve("123", now); ok {
		t.Fatal("a send was booked during a pause")
	}
	if wait, ok := p.Reserve("123", now.Add(58*time.Second)); !ok || wait != 2*time.Second {
		t.Fatalf("near the pause's end: wait %s ok %v", wait, ok)
	}
}

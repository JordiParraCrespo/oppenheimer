package cli

import (
	"testing"
	"time"
)

// `runner sessions wake-in` reads Go's durations and whole days, the unit an
// agent waiting on a review reaches for, and refuses anything else rather
// than sleeping for a guess.
func TestAWakeDelayIsADurationOrWholeDays(t *testing.T) {
	for value, want := range map[string]time.Duration{
		"90s": 90 * time.Second, "30m": 30 * time.Minute, "1h30m": 90 * time.Minute, "2d": 48 * time.Hour,
	} {
		got, err := ParseWakeDelay(value)
		if err != nil || got != want {
			t.Fatalf("%s: %v, %v", value, got, err)
		}
	}
	for _, value := range []string{"soon", "1.5d", "-1d", "d", ""} {
		if _, err := ParseWakeDelay(value); err == nil {
			t.Fatalf("%q was read as a delay", value)
		}
	}
}

package domain

import "testing"

// A watching browser hears the pointer once per move, not thirty times a
// second while it rests; nothing while it drives; and where it is again the
// moment it goes back to watching, even if it did not move meanwhile. A trail
// that kept its last reading across control would leave the drawn pointer
// where it was before the reader took control.
func TestThePointerTrailSendsMovesWhileWatchingAndResendsAfterControl(t *testing.T) {
	var trail PointerTrail
	at := func(x float64) Pointer { return Pointer{X: x, Y: 10, Width: 1920, Height: 1080} }

	steps := []struct {
		reading Pointer
		control bool
		send    bool
	}{
		{at(1), false, true},
		{at(1), false, false},
		{at(2), false, true},
		{at(3), true, false},
		{at(3), true, false},
		{at(3), false, true},
		{at(3), false, false},
		{Pointer{X: 3, Y: 10, Width: 1440, Height: 900}, false, true},
	}
	for i, step := range steps {
		if got := trail.Next(step.reading, step.control); got != step.send {
			t.Fatalf("step %d (%+v, control %v): send %v, want %v", i, step.reading, step.control, got, step.send)
		}
	}
}

package domain

import (
	"errors"
	"slices"
)

// Input is one gesture or key from the console. Points are fractions of the
// screen, 0 to 1 from the top left. Which fields a kind reads: tap X and Y,
// swipe X, Y, ToX, ToY, DurationMs and Momentum, text Text, key Key, button
// Button.
type Input struct {
	Kind     string
	X, Y     float64
	ToX, ToY float64
	// DurationMs is how long the reader's swipe took; 0 is the device's own
	// default. Momentum is a flick: the finger left the screen moving.
	DurationMs  int
	Momentum    bool
	Text        string
	Key, Button string
}

// MaxSwipeMs is the longest swipe played back (DEVICE_SWIPE_MAX_MS).
const MaxSwipeMs = 10_000

var (
	inputKinds = []string{"tap", "swipe", "text", "key", "button"}
	keys       = []string{"enter", "backspace", "escape", "tab"}
	buttons    = []string{"home", "back", "appSwitch"}
)

// ErrBadInput is an input this context does not take.
var ErrBadInput = errors.New("not an input a device takes")

// Validate checks the input names what its kind needs and nothing out of range.
func (in Input) Validate() error {
	inScreen := func(v float64) bool { return v >= 0 && v <= 1 }
	switch {
	case !slices.Contains(inputKinds, in.Kind):
		return ErrBadInput
	case !inScreen(in.X) || !inScreen(in.Y) || !inScreen(in.ToX) || !inScreen(in.ToY):
		return ErrBadInput
	case in.DurationMs < 0 || in.DurationMs > MaxSwipeMs:
		return ErrBadInput
	case in.Kind == "text" && (in.Text == "" || len(in.Text) > 1000):
		return ErrBadInput
	case in.Kind == "key" && !slices.Contains(keys, in.Key):
		return ErrBadInput
	case in.Kind == "button" && !slices.Contains(buttons, in.Button):
		return ErrBadInput
	}
	return nil
}

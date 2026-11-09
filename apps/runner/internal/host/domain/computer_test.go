package domain

import (
	"errors"
	"testing"
)

// A screen larger than the image the model sees is answered scaled down, and
// a point in that image must land on the same spot of the real screen: a
// click that drifts by the scale factor presses the wrong button.
func TestComputerRequestScalesImagePixelsOntoTheScreen(t *testing.T) {
	width, height := FitScreen(2560, 1600, 1280)
	if width != 1280 || height != 800 {
		t.Fatalf("FitScreen = %d by %d, want 1280 by 800", width, height)
	}
	screen := Screen{Width: 2560, Height: 1600}
	got := ComputerRequest{Action: ComputerDrag, X: 0, Y: 0, ToX: 1279, ToY: 799}.ScaledTo(width, height, screen)
	if got.X != 1 || got.Y != 1 || got.ToX != 2559 || got.ToY != 1599 {
		t.Fatalf("scaled to (%d, %d) → (%d, %d), want (1, 1) → (2559, 1599)", got.X, got.Y, got.ToX, got.ToY)
	}
}

func TestFitScreenNeverEnlarges(t *testing.T) {
	if width, height := FitScreen(1024, 768, 1280); width != 1024 || height != 768 {
		t.Fatalf("FitScreen = %d by %d, want the screen's own 1024 by 768", width, height)
	}
}

// What an action needs is checked before the mouse moves: a click outside
// the image, or a key that is not one, must refuse rather than act somewhere.
func TestComputerRequestValidate(t *testing.T) {
	cases := []struct {
		name string
		req  ComputerRequest
		want error
	}{
		{"screenshot needs nothing", ComputerRequest{Action: ComputerScreenshot}, nil},
		{"click inside", ComputerRequest{Action: ComputerClick, X: 1279, Y: 799}, nil},
		{"click past the edge", ComputerRequest{Action: ComputerClick, X: 1280, Y: 10}, ErrComputerActionShape},
		{"drag ends outside", ComputerRequest{Action: ComputerDrag, X: 5, Y: 5, ToX: 5, ToY: 800}, ErrComputerActionShape},
		{"scroll with no direction", ComputerRequest{Action: ComputerScroll, X: 5, Y: 5}, ErrComputerActionShape},
		{"type with no text", ComputerRequest{Action: ComputerType}, ErrComputerActionShape},
		{"key with a combination", ComputerRequest{Action: ComputerKey, Keys: []string{"cmd+shift+4", "enter"}}, nil},
		{"key that is a word", ComputerRequest{Action: ComputerKey, Keys: []string{"ctrl+banana"}}, ErrComputerKey},
		{"unknown action", ComputerRequest{Action: "shake"}, ErrComputerActionUnknown},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := c.req.Validate(1280, 800); !errors.Is(err, c.want) {
				t.Fatalf("Validate = %v, want %v", err, c.want)
			}
		})
	}
}

func TestParseKeyPressSplitsModifiersFromTheKey(t *testing.T) {
	press, err := ParseKeyPress("ctrl+shift+f5")
	if err != nil {
		t.Fatal(err)
	}
	if len(press.Modifiers) != 2 || press.Modifiers[0] != "ctrl" || press.Modifiers[1] != "shift" || press.Key != "f5" {
		t.Fatalf("ParseKeyPress = %+v", press)
	}
}

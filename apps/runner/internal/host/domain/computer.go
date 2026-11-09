package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// ComputerPolicy is whether this host lets bots see its screen and use its
// mouse and keyboard (`computer.act`, 25 §4.2). Like ExecPolicy it is the
// host's own setting, in a file the control plane never reads or writes: a
// screen shows whatever is open on it, and a mouse can open anything.
type ComputerPolicy struct {
	Enabled bool `json:"enabled"`
}

// ComputerAction is what one `computer.act` does before the screen is read.
type ComputerAction string

// The actions, as the protocol names them.
const (
	ComputerScreenshot  ComputerAction = "screenshot"
	ComputerMove        ComputerAction = "move"
	ComputerClick       ComputerAction = "click"
	ComputerDoubleClick ComputerAction = "double_click"
	ComputerRightClick  ComputerAction = "right_click"
	ComputerMiddleClick ComputerAction = "middle_click"
	ComputerDrag        ComputerAction = "drag"
	ComputerScroll      ComputerAction = "scroll"
	ComputerType        ComputerAction = "type"
	ComputerKey         ComputerAction = "key"
	ComputerWait        ComputerAction = "wait"
)

// ComputerSettle is how long the screen is left to redraw after an action,
// before it is captured: a click answered with the screen as it was tells the
// model nothing happened.
const ComputerSettle = 700 * time.Millisecond

// ComputerRequest is one action. Its coordinates are pixels of the image the
// last answer carried; ScaledTo turns them into the screen's own units.
type ComputerRequest struct {
	Action           ComputerAction
	X, Y             int
	ToX, ToY         int
	ScrollX, ScrollY int
	Text             string
	Keys             []string
	Wait             time.Duration
	// MaxEdge is the long edge of the image answered, in pixels, and
	// MaxBytes its size as a JPEG.
	MaxEdge  int
	MaxBytes int
}

// Screen is the host's screen: its size in the units its pointer moves in
// (points on a Mac, pixels on X), and a name where it has one.
type Screen struct {
	Width, Height int
	Display       string
}

// Screenshot is what the screen showed: a JPEG of Width by Height pixels.
type Screenshot struct {
	JPEG          []byte
	Width, Height int
	Display       string
}

// The reasons an action is refused, or a screen cannot be used.
var (
	ErrComputerActionUnknown = errors.New("unknown action")
	ErrComputerActionShape   = errors.New("the action does not fit")
	ErrComputerKey           = errors.New("not a key")
	// ErrNoScreen is a host with no screen this runner can reach: no display,
	// or none of the tools that read and drive one.
	ErrNoScreen = errors.New("no screen to use")
)

// Pointed reports whether the action acts at (X, Y).
func (a ComputerAction) Pointed() bool {
	switch a {
	case ComputerMove, ComputerClick, ComputerDoubleClick, ComputerRightClick,
		ComputerMiddleClick, ComputerDrag, ComputerScroll:
		return true
	}
	return false
}

// Validate checks the request against an image of width by height pixels:
// the action is known, it has what it needs, and it points inside the image.
func (r ComputerRequest) Validate(width, height int) error {
	inside := func(x, y int) error {
		if x < 0 || y < 0 || x >= width || y >= height {
			return fmt.Errorf("%w: (%d, %d) is outside the %d by %d screen image", ErrComputerActionShape, x, y, width, height)
		}
		return nil
	}
	switch r.Action {
	case ComputerScreenshot, ComputerWait:
		return nil
	case ComputerMove, ComputerClick, ComputerDoubleClick, ComputerRightClick, ComputerMiddleClick:
		return inside(r.X, r.Y)
	case ComputerDrag:
		if err := inside(r.X, r.Y); err != nil {
			return err
		}
		return inside(r.ToX, r.ToY)
	case ComputerScroll:
		if r.ScrollX == 0 && r.ScrollY == 0 {
			return fmt.Errorf("%w: scroll needs scrollX or scrollY", ErrComputerActionShape)
		}
		return inside(r.X, r.Y)
	case ComputerType:
		if r.Text == "" {
			return fmt.Errorf("%w: type needs text", ErrComputerActionShape)
		}
		return nil
	case ComputerKey:
		if len(r.Keys) == 0 {
			return fmt.Errorf("%w: key needs keys", ErrComputerActionShape)
		}
		for _, key := range r.Keys {
			if _, err := ParseKeyPress(key); err != nil {
				return err
			}
		}
		return nil
	}
	return fmt.Errorf("%w %q", ErrComputerActionUnknown, r.Action)
}

// ScaledTo is the request with its coordinates moved from an image of width
// by height pixels onto screen, each to the middle of the pixel it named.
func (r ComputerRequest) ScaledTo(width, height int, screen Screen) ComputerRequest {
	r.X, r.Y = scale(r.X, width, screen.Width), scale(r.Y, height, screen.Height)
	r.ToX, r.ToY = scale(r.ToX, width, screen.Width), scale(r.ToY, height, screen.Height)
	return r
}

func scale(at, image, screen int) int {
	if image <= 0 || image == screen {
		return at
	}
	scaled := (2*at + 1) * screen / (2 * image)
	return min(scaled, screen-1)
}

// FitScreen is the size of the image a screen of width by height is answered
// as: the same shape, its long edge at most maxEdge, never enlarged.
func FitScreen(width, height, maxEdge int) (int, int) {
	long := max(width, height)
	if maxEdge <= 0 || long <= maxEdge {
		return width, height
	}
	return max(1, width*maxEdge/long), max(1, height*maxEdge/long)
}

// KeyPress is one key with the modifiers held while it is pressed.
type KeyPress struct {
	// Modifiers are of ctrl, alt, shift and cmd, in the order given.
	Modifiers []string
	// Key is a letter, a digit, f1 to f12, or a named key (enter, tab, ...).
	Key string
}

var keyPressPattern = regexp.MustCompile(
	`^(?:(?:ctrl|alt|shift|cmd)\+){0,4}(?:[a-z0-9]|f(?:[1-9]|1[0-2])|enter|tab|escape|backspace|delete|space|up|down|left|right|home|end|pageup|pagedown)$`)

// ParseKeyPress reads a press as the protocol writes it: `cmd+shift+4`,
// `ctrl+c`, `enter`.
func ParseKeyPress(value string) (KeyPress, error) {
	if !keyPressPattern.MatchString(value) {
		return KeyPress{}, fmt.Errorf("%w: %q (modifiers ctrl, alt, shift, cmd, then one key: ctrl+c, cmd+shift+4, enter)", ErrComputerKey, value)
	}
	parts := strings.Split(value, "+")
	return KeyPress{Modifiers: parts[:len(parts)-1], Key: parts[len(parts)-1]}, nil
}

package desktop

import (
	"encoding/json"
	"fmt"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// macModifiers are the protocol's modifiers as System Events names them.
var macModifiers = map[string]string{
	"ctrl": "control down", "alt": "option down", "shift": "shift down", "cmd": "command down",
}

// macKeyCodes are the virtual key codes of an ANSI keyboard
// (Carbon's kVK_* constants), by the protocol's key names.
var macKeyCodes = map[string]int{
	"a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11,
	"q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21,
	"6": 22, "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "o": 31, "u": 32, "i": 34, "p": 35,
	"l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
	"enter": 36, "tab": 48, "space": 49, "backspace": 51, "escape": 53, "delete": 117,
	"home": 115, "end": 119, "pageup": 116, "pagedown": 121,
	"left": 123, "right": 124, "down": 125, "up": 126,
	"f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98, "f8": 100,
	"f9": 101, "f10": 109, "f11": 103, "f12": 111,
}

type macPress struct {
	Code  int      `json:"code"`
	Using []string `json:"using"`
}

type macAction struct {
	Action  string     `json:"action"`
	Pointed bool       `json:"pointed"`
	X       int        `json:"x"`
	Y       int        `json:"y"`
	ToX     int        `json:"toX"`
	ToY     int        `json:"toY"`
	ScrollX int        `json:"scrollX"`
	ScrollY int        `json:"scrollY"`
	Text    string     `json:"text,omitempty"`
	Presses []macPress `json:"presses,omitempty"`
}

// macActionJSON is req as macActScript reads it: its keys already virtual
// key codes with the modifiers System Events takes.
func macActionJSON(req domain.ComputerRequest) (string, error) {
	action := macAction{
		Action: string(req.Action), Pointed: req.Action.Pointed(),
		X: req.X, Y: req.Y, ToX: req.ToX, ToY: req.ToY,
		ScrollX: req.ScrollX, ScrollY: req.ScrollY, Text: req.Text,
	}
	for _, key := range req.Keys {
		press, err := domain.ParseKeyPress(key)
		if err != nil {
			return "", err
		}
		code, ok := macKeyCodes[press.Key]
		if !ok {
			return "", fmt.Errorf("%w: %q has no key code", domain.ErrComputerKey, press.Key)
		}
		using := make([]string, 0, len(press.Modifiers))
		for _, modifier := range press.Modifiers {
			using = append(using, macModifiers[modifier])
		}
		action.Presses = append(action.Presses, macPress{Code: code, Using: using})
	}
	raw, err := json.Marshal(action)
	return string(raw), err
}

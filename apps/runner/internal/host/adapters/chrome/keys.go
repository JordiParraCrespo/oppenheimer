package chrome

import (
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// keyEvent is a press as DevTools' Input.dispatchKeyEvent takes it.
type keyEvent struct {
	Key       string
	Code      string
	VirtualKC int
	// Text is what the key types when no modifier but shift is held.
	Text      string
	Modifiers int
}

// modifierBits are DevTools' modifier flags.
var modifierBits = map[string]int{"alt": 1, "ctrl": 2, "cmd": 4, "shift": 8}

type namedKey struct {
	key, code string
	vk        int
	text      string
}

var namedKeys = map[string]namedKey{
	"enter": {"Enter", "Enter", 13, "\r"}, "tab": {"Tab", "Tab", 9, ""},
	"escape": {"Escape", "Escape", 27, ""}, "backspace": {"Backspace", "Backspace", 8, ""},
	"delete": {"Delete", "Delete", 46, ""}, "space": {" ", "Space", 32, " "},
	"left": {"ArrowLeft", "ArrowLeft", 37, ""}, "up": {"ArrowUp", "ArrowUp", 38, ""},
	"right": {"ArrowRight", "ArrowRight", 39, ""}, "down": {"ArrowDown", "ArrowDown", 40, ""},
	"home": {"Home", "Home", 36, ""}, "end": {"End", "End", 35, ""},
	"pageup": {"PageUp", "PageUp", 33, ""}, "pagedown": {"PageDown", "PageDown", 34, ""},
}

// keyEventOf turns the protocol's press into the browser's.
func keyEventOf(press domain.KeyPress) keyEvent {
	event := keyEvent{}
	for _, modifier := range press.Modifiers {
		event.Modifiers |= modifierBits[modifier]
	}
	typing := event.Modifiers&^modifierBits["shift"] == 0
	key := press.Key
	switch named, ok := namedKeys[key]; {
	case ok:
		event.Key, event.Code, event.VirtualKC, event.Text = named.key, named.code, named.vk, named.text
	case len(key) > 1: // f1 to f12
		number := 0
		for _, digit := range key[1:] {
			number = number*10 + int(digit-'0')
		}
		event.Key, event.Code, event.VirtualKC = strings.ToUpper(key), strings.ToUpper(key), 111+number
	case key[0] >= '0' && key[0] <= '9':
		event.Key, event.Code, event.VirtualKC, event.Text = key, "Digit"+key, int(key[0]), key
	default:
		upper := strings.ToUpper(key)
		event.Key, event.Code, event.VirtualKC, event.Text = key, "Key"+upper, int(upper[0]), key
		if event.Modifiers&modifierBits["shift"] != 0 {
			event.Key, event.Text = upper, upper
		}
	}
	if !typing {
		event.Text = ""
	}
	return event
}

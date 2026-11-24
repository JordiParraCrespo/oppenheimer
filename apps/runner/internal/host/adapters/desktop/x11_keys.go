package desktop

import (
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// xModifiers are the protocol's modifiers by X keysym.
var xModifiers = map[string]string{"ctrl": "ctrl", "alt": "alt", "shift": "shift", "cmd": "super"}

// xKeys are the protocol's named keys by X keysym; a letter, a digit or an
// f-key is its own keysym (f5 is F5).
var xKeys = map[string]string{
	"enter": "Return", "tab": "Tab", "escape": "Escape", "backspace": "BackSpace",
	"delete": "Delete", "space": "space", "up": "Up", "down": "Down", "left": "Left",
	"right": "Right", "home": "Home", "end": "End", "pageup": "Prior", "pagedown": "Next",
}

// xKeysym is a press as `xdotool key` takes it: `ctrl+shift+F5`, `super+Return`.
func xKeysym(press domain.KeyPress) string {
	parts := make([]string, 0, len(press.Modifiers)+1)
	for _, modifier := range press.Modifiers {
		parts = append(parts, xModifiers[modifier])
	}
	key := press.Key
	if named, ok := xKeys[key]; ok {
		key = named
	} else if len(key) > 1 {
		key = strings.ToUpper(key)
	}
	return strings.Join(append(parts, key), "+")
}

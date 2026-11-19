package cli

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/statuspty"
)

// Look is the runner's face on a terminal: the console's mark (the fedora),
// its rationed colours and its status vocabulary, so a person who pairs a
// host from the console meets the same product in their shell.
//
// Everything it adds is for a person at a terminal. Written to a pipe, a
// file or a test's buffer, a Look is plain and every line reads exactly as
// it did without it: scripts that wrap the runner, the service's log and
// the tests see no escape codes and no mark. NO_COLOR and TERM=dumb turn it
// off on a terminal too; CLICOLOR_FORCE (or FORCE_COLOR) turns it on
// without one.
type Look struct {
	color     bool
	truecolor bool
}

// The palette is the design system's (packages/frontend/design-system/web,
// globals.css): one blue for what a person can act on, and the three
// status hues only for state. The 500 steps read on a light and on a dark
// terminal alike; a terminal without 24-bit colour gets the nearest of its
// own sixteen, which its theme already tunes for its background.
type rgb [3]uint8

var (
	accentRGB, okRGB, warnRGB, failRGB = rgb{0x00, 0x71, 0xe3}, rgb{0x03, 0xaa, 0x49}, rgb{0xed, 0x63, 0x00}, rgb{0xe8, 0x27, 0x2c}
)

// LookFor is the Look for out: decorated only when out is a terminal (or
// colour is forced), plain otherwise.
func LookFor(out io.Writer) Look {
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		return Look{}
	}
	forced := enabled(os.Getenv("CLICOLOR_FORCE")) || enabled(os.Getenv("FORCE_COLOR"))
	if !forced {
		file, ok := out.(*os.File)
		if !ok || !statuspty.IsTerminal(int(file.Fd())) {
			return Look{}
		}
	}
	colorterm := os.Getenv("COLORTERM")
	return Look{color: true, truecolor: colorterm == "truecolor" || colorterm == "24bit"}
}

func enabled(value string) bool { return value != "" && value != "0" && value != "false" }

// Decorated reports whether this Look draws anything at all.
func (l Look) Decorated() bool { return l.color }

func (l Look) sgr(code, text string) string {
	if !l.color || text == "" {
		return text
	}
	return "\033[" + code + "m" + text + "\033[0m"
}

func (l Look) hue(c rgb, fallback, text string) string {
	if l.truecolor {
		return l.sgr(fmt.Sprintf("38;2;%d;%d;%d", c[0], c[1], c[2]), text)
	}
	return l.sgr(fallback, text)
}

// Bold is a name or a figure the line is about.
func (l Look) Bold(text string) string { return l.sgr("1", text) }

// Dim is what supports a line without being its point: paths, hints, units.
func (l Look) Dim(text string) string { return l.sgr("2", text) }

// Accent is the one blue: a command to type, a URL to open.
func (l Look) Accent(text string) string { return l.hue(accentRGB, "34", text) }

// OK, Warn and Fail colour a state, never decoration.
func (l Look) OK(text string) string   { return l.hue(okRGB, "32", text) }
func (l Look) Warn(text string) string { return l.hue(warnRGB, "33", text) }
func (l Look) Fail(text string) string { return l.hue(failRGB, "31", text) }

// State is a coloured dot and a word, the way the console's sidebar shows a
// session: the word alone when plain, so nothing parsing it changes.
func (l Look) State(kind, word string) string {
	if !l.color {
		return word
	}
	switch kind {
	case "ok":
		return l.OK("●") + " " + word
	case "warn":
		return l.Warn("▲") + " " + word
	case "fail":
		return l.Fail("✕") + " " + word
	default:
		return l.Dim("○") + " " + word
	}
}

// Label prefixes a line the way the errors and warnings do: "error:" in red,
// "warning:" in amber, the word itself unchanged when plain.
func (l Look) Label(kind, word string) string {
	switch kind {
	case "fail":
		return l.Bold(l.Fail(word))
	case "warn":
		return l.Bold(l.Warn(word))
	default:
		return l.Bold(word)
	}
}

// mark is the logo's fedora (apps/runner/packaging/macos/AppIcon.svg) in
// block characters, drawn to its proportions: the crown's rounded top with
// its shallow dent (eighth blocks), the crown tapering out to its base (half
// blocks), the gap above the brim, and the brim's lens. It stands beside the
// product's name.
var mark = [6]string{
	"    ▗▇▇▆▇▇▖    ",
	"    ███████    ",
	"   ▐███████▌   ",
	"   █████████   ",
	"▗▄▄▄▄▄▄▄▄▄▄▄▄▄▖",
	" ▀▜█████████▛▀ ",
}

// Banner draws the mark with the product's name, title after it, and
// subtitle under it, beside the mark's middle rows. It draws nothing when
// plain: a banner in a log or a pipe is noise.
func (l Look) Banner(w io.Writer, title, subtitle string) {
	if !l.color {
		return
	}
	beside := [len(mark)]string{2: l.Bold("Oppenheimer Runner") + title, 3: l.Dim(subtitle)}
	var b strings.Builder
	b.WriteString("\n")
	for i, row := range mark {
		line := "  " + l.Bold(row)
		if beside[i] != "" {
			line += "   " + beside[i]
		}
		b.WriteString(strings.TrimRight(line, " ") + "\n")
	}
	b.WriteString("\n")
	_, _ = io.WriteString(w, b.String())
}

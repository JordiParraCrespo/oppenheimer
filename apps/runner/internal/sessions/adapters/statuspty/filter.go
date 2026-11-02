// Package statuspty is the runner's `pty` wrapper: it runs an agent on a
// terminal of its own inside the tmux pane, answers the agent's OSC 7501
// probe (tmux answers none), keeps what the agent reports, and passes every
// other byte through untouched in both directions.
package statuspty

import (
	"bytes"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const (
	oscPrefix = "\x1b]7501;"
	// tmuxPrefix opens tmux's passthrough, which a program that knows it runs
	// in tmux may wrap a sequence in: `ESC P tmux; <sequence, each ESC
	// doubled> ESC \`.
	tmuxPrefix = "\x1bPtmux;"
	// maxSequence bounds a sequence held while it is read: a report is a few
	// hundred bytes, and a program that never ends one must not make the
	// wrapper hold its output.
	maxSequence = 8 << 10
)

type filterState int

const (
	plain filterState = iota
	prefix
	osc
	passthrough
	passthroughEsc
)

// Filter splits a program's output into what reaches the pane and the OSC
// 7501 sequences in it. A sequence split across reads is held until it is
// complete; bytes that turn out not to be one go on unchanged and in order.
type Filter struct {
	// OnQuery is called for the program's `OSC 7501 ; ?` probe.
	OnQuery func()
	// OnReport is called for each report the program sends.
	OnReport func(domain.ProgramStatus)

	state filterState
	held  []byte
}

// Write takes the next bytes of output and returns those the pane gets.
func (f *Filter) Write(p []byte) []byte {
	out := make([]byte, 0, len(p))
	for len(p) > 0 {
		if f.state == plain {
			i := bytes.IndexByte(p, 0x1b)
			if i < 0 {
				return append(out, p...)
			}
			out = append(out, p[:i]...)
			p = p[i:]
			f.state, f.held = prefix, f.held[:0]
		}
		b := p[0]
		p = p[1:]
		f.held = append(f.held, b)
		out = f.step(b, out)
	}
	return out
}

// Flush returns whatever is held, for a program that ended mid-sequence.
func (f *Filter) Flush() []byte {
	held := append([]byte(nil), f.held...)
	f.state, f.held = plain, f.held[:0]
	return held
}

func (f *Filter) step(b byte, out []byte) []byte {
	switch f.state {
	case prefix:
		switch {
		case string(f.held) == oscPrefix:
			f.state = osc
		case string(f.held) == tmuxPrefix:
			f.state = passthrough
		case !hasPrefix(oscPrefix, f.held) && !hasPrefix(tmuxPrefix, f.held):
			// Not one of ours. A new ESC may start the next one.
			if b == 0x1b && len(f.held) > 1 {
				out = append(out, f.held[:len(f.held)-1]...)
				f.held = append(f.held[:0], b)
				return out
			}
			return f.release(out)
		}
	case osc:
		switch {
		case b == 0x07:
			f.handle(f.held[len(oscPrefix) : len(f.held)-1])
			f.state, f.held = plain, f.held[:0]
		case len(f.held) >= 2 && f.held[len(f.held)-2] == 0x1b && b == '\\':
			f.handle(f.held[len(oscPrefix) : len(f.held)-2])
			f.state, f.held = plain, f.held[:0]
		case len(f.held) >= 2 && f.held[len(f.held)-2] == 0x1b:
			// ESC then anything but `\` ends a sequence that was not well formed.
			return f.release(out)
		}
	case passthrough:
		if b == 0x1b {
			f.state = passthroughEsc
		}
	case passthroughEsc:
		switch b {
		case 0x1b:
			// A doubled ESC is one ESC of the wrapped sequence.
			f.state = passthrough
		case '\\':
			if inner := unwrap(f.held[len(tmuxPrefix) : len(f.held)-2]); inner != nil {
				f.handle(inner)
				f.state, f.held = plain, f.held[:0]
				return out
			}
			return f.release(out)
		default:
			return f.release(out)
		}
	}
	if len(f.held) > maxSequence {
		return f.release(out)
	}
	return out
}

// release passes what was held on as ordinary output.
func (f *Filter) release(out []byte) []byte {
	out = append(out, f.held...)
	f.state, f.held = plain, f.held[:0]
	return out
}

// unwrap returns the payload of an OSC 7501 sequence tmux's passthrough
// carried, or nil when it carried anything else, which then goes on as it
// came.
func unwrap(body []byte) []byte {
	inner := bytes.ReplaceAll(body, []byte{0x1b, 0x1b}, []byte{0x1b})
	if !bytes.HasPrefix(inner, []byte(oscPrefix)) {
		return nil
	}
	inner = inner[len(oscPrefix):]
	switch {
	case bytes.HasSuffix(inner, []byte{0x07}):
		return inner[:len(inner)-1]
	case bytes.HasSuffix(inner, []byte{0x1b, '\\'}):
		return inner[:len(inner)-2]
	}
	return nil
}

func (f *Filter) handle(payload []byte) {
	if bytes.HasPrefix(payload, []byte(domain.ProgramStatusQuery)) {
		if f.OnQuery != nil {
			f.OnQuery()
		}
		return
	}
	if status, ok := domain.ParseProgramStatus(string(payload)); ok && f.OnReport != nil {
		f.OnReport(status)
	}
}

func hasPrefix(full string, held []byte) bool {
	return len(held) <= len(full) && full[:len(held)] == string(held)
}

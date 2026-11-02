package statuspty

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

type seen struct {
	queries int
	reports []domain.ProgramStatus
}

func newFilter(s *seen) *Filter {
	return &Filter{
		OnQuery:  func() { s.queries++ },
		OnReport: func(r domain.ProgramStatus) { s.reports = append(s.reports, r) },
	}
}

// feed writes the input one byte at a time as well as whole, and both must
// give the pane the same bytes: a sequence the PTY splits across reads is
// the ordinary case, not an edge.
func feed(t *testing.T, in string) (string, seen) {
	t.Helper()
	var whole seen
	f := newFilter(&whole)
	out := string(f.Write([]byte(in))) + string(f.Flush())

	var split seen
	g := newFilter(&split)
	var bytewise []byte
	for i := 0; i < len(in); i++ {
		bytewise = append(bytewise, g.Write([]byte{in[i]})...)
	}
	bytewise = append(bytewise, g.Flush()...)
	if string(bytewise) != out || split.queries != whole.queries || len(split.reports) != len(whole.reports) {
		t.Fatalf("split reads differ: %q vs %q", bytewise, out)
	}
	return out, whole
}

// The pane must get every byte that is not ours, in order: a filter that ate
// a title, a colour or a cursor move would corrupt the terminal the person
// types in.
func TestFilterPassesEverythingElseThrough(t *testing.T) {
	in := "plain \x1b[31mred\x1b[0m \x1b]0;title\x07 \x1b]52;c;aGk=\x1b\\ \x1bPq#0\x1b\\ \x1b]750;x\x07 \x1b\x1b[A\x1bPtmux;\x1b\x1b]52;c;eA==\x07\x1b\\ end"
	out, s := feed(t, in)
	if out != in {
		t.Fatalf("pane got %q, want %q", out, in)
	}
	if s.queries != 0 || len(s.reports) != 0 {
		t.Fatalf("took %d queries and %v from output with none", s.queries, s.reports)
	}
}

// The probe is what Claude Code waits on before it reports anything; the
// wrapper must see it, and tmux must not get it.
func TestFilterTakesTheProbe(t *testing.T) {
	out, s := feed(t, "a\x1b]7501;?\x1b\\b\x1b]7501;?\x07c")
	if out != "abc" || s.queries != 2 {
		t.Fatalf("out %q, %d queries", out, s.queries)
	}
}

// Claude Code's own report, as its encoder writes it, with a base64 message.
func TestFilterTakesReports(t *testing.T) {
	out, s := feed(t, "x\x1b]7501;state=blocked:app=claude-code:kind=permission:progress=40:msg=QXBwbHk/\x1b\\y")
	if out != "xy" || len(s.reports) != 1 {
		t.Fatalf("out %q, reports %v", out, s.reports)
	}
	r := s.reports[0]
	if r.State != "blocked" || r.Kind != "permission" || r.Progress == nil || *r.Progress != 40 || r.Message != "Apply?" || r.App != "claude-code" {
		t.Fatalf("report %+v", r)
	}
}

// A program that knows it is in tmux may wrap the sequence in tmux's
// passthrough; it is the same report.
func TestFilterUnwrapsTmuxPassthrough(t *testing.T) {
	out, s := feed(t, "a\x1bPtmux;\x1b\x1b]7501;state=working\x1b\x1b\\\x1b\\b\x1bPtmux;\x1b\x1b]7501;?\x07\x1b\\c")
	if out != "abc" || len(s.reports) != 1 || s.reports[0].State != "working" || s.queries != 1 {
		t.Fatalf("out %q, reports %v, queries %d", out, s.reports, s.queries)
	}
}

// A sequence that never ends must not hold the program's output hostage.
func TestFilterGivesUpOnARunawaySequence(t *testing.T) {
	in := "\x1b]7501;state=working:msg=" + string(make([]byte, maxSequence+10))
	out, s := feed(t, in)
	if out != in || len(s.reports) != 0 {
		t.Fatalf("held %d of %d bytes", len(in)-len(out), len(in))
	}
}

func TestFilterIgnoresUnknownStates(t *testing.T) {
	out, s := feed(t, "\x1b]7501;state=bogus\x1b\\ok")
	if out != "ok" || len(s.reports) != 0 {
		t.Fatalf("out %q, reports %v", out, s.reports)
	}
}

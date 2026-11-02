package domain

import (
	"encoding/base64"
	"strings"
	"testing"
)

func report(t *testing.T, payload string) ProgramStatus {
	t.Helper()
	s, ok := ParseProgramStatus(payload)
	if !ok {
		t.Fatalf("%q is not a report", payload)
	}
	return s
}

// A kind or a progress the protocol does not allow on a state is dropped: an
// `idle` record claiming 40% would put a progress bar on a session that is
// doing nothing.
func TestParseProgramStatusKeepsOnlyWhatTheStateAllows(t *testing.T) {
	s := report(t, "state=idle:kind=permission:progress=40:future=x")
	if s.Kind != "" || s.Progress != nil {
		t.Fatalf("idle kept %+v", s)
	}
	b := report(t, "state=blocked:kind=telepathy:progress=101")
	if b.Kind != "" || b.Progress != nil {
		t.Fatalf("blocked kept an unknown kind or an out-of-range progress: %+v", b)
	}
	if _, ok := ParseProgramStatus("kind=permission"); ok {
		t.Fatal("a report with no state was taken")
	}
}

// A program can make the runner hold only so much text.
func TestParseProgramStatusBoundsItsText(t *testing.T) {
	long := strings.Repeat("é", 2000)
	s := report(t, "state=done:msg="+b64(long)+":title=%%%")
	if len(s.Message) > maxProgramText || s.Title != "" {
		t.Fatalf("message of %d bytes, title %q", len(s.Message), s.Title)
	}
}

// `clear` takes a record and those below it, and the turn goes up each time
// the root leaves `working`, whatever it leaves for.
func TestProgramReportApply(t *testing.T) {
	var r ProgramReport
	r.Apply(report(t, "state=working"))
	r.Apply(report(t, "state=working:id=a"))
	r.Apply(report(t, "state=blocked:id=a/b:kind=question"))
	r.Apply(report(t, "state=idle:id=ab"))
	r.Apply(report(t, "state=clear:id=a"))
	if _, ok := r.Records["a/b"]; ok {
		t.Fatal("clear of a left a/b")
	}
	if _, ok := r.Records["ab"]; !ok {
		t.Fatal("clear of a took ab, which is not below it")
	}
	if r.Turn != 0 {
		t.Fatalf("turn %d before the root left working", r.Turn)
	}
	r.Apply(report(t, "state=blocked:kind=permission"))
	r.Apply(report(t, "state=working"))
	r.Apply(report(t, "state=clear"))
	if r.Turn != 2 || len(r.Records) != 0 || !r.Reported {
		t.Fatalf("turn %d, %d records, reported %v", r.Turn, len(r.Records), r.Reported)
	}
	if _, ok := r.Root(); ok {
		t.Fatal("a cleared report still has a root")
	}
}

func TestProgramStatusSessionState(t *testing.T) {
	for word, want := range map[string]State{
		"working": StateWorking, "blocked": StateBlocked, "done": StateDone, "error": StateDone, "idle": StateIdle,
	} {
		if got := report(t, "state="+word).SessionState(); got != want {
			t.Errorf("%s → %s, want %s", word, got, want)
		}
	}
}

func b64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

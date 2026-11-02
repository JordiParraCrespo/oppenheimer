package app_test

import (
	"context"
	"maps"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// heldReports stands in for the `pty` wrapper's report files.
type heldReports struct {
	mu        sync.Mutex
	reports   map[string]domain.ProgramReport
	forgotten []string
}

func (h *heldReports) Wrap(id string) []string {
	return []string{"/opt/runner", "pty", "--report", id, "--"}
}

func (h *heldReports) Read(id string) (domain.ProgramReport, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.reports[id]
	// A copy, as the wrapper's file is read afresh each time.
	r.Records = maps.Clone(r.Records)
	return r, ok
}

func (h *heldReports) Forget(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.forgotten = append(h.forgotten, id)
	delete(h.reports, id)
}

func (h *heldReports) say(id, payload string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.reports[id]
	r.Records = maps.Clone(r.Records)
	status, _ := domain.ParseProgramStatus(payload)
	r.Apply(status)
	h.reports[id] = r
}

type heard struct {
	mu       sync.Mutex
	sessions []domain.Session
}

func (r *heard) SessionChanged(s domain.Session) {
	r.mu.Lock()
	r.sessions = append(r.sessions, s)
	r.mu.Unlock()
}
func (r *heard) FirstPrompt(domain.Session, string, func()) bool  { return true }
func (r *heard) DecisionChanged(domain.Session, *domain.Decision) {}
func (r *heard) TerminalMatched(string, string, int)              {}

func (r *heard) last() domain.Session {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sessions[len(r.sessions)-1]
}

func (r *heard) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.sessions)
}

func newReportingService(t *testing.T, now func() time.Time) (*app.Service, *fake.Terminals, *heldReports, *heard) {
	t.Helper()
	terminals := fake.NewTerminals()
	reports := &heldReports{reports: map[string]domain.ProgramReport{}}
	events := &heard{}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Publisher: events, Places: fake.NewPlaces(), Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
		ProgramStatus: reports, Now: now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, terminals, reports, events
}

// The agent's own word outranks the screen: a spinner still painted above a
// permission prompt reads as working to the classifier, which is exactly
// the session the sidebar must show as waiting on the person.
func TestTheAgentsReportOutranksTheScreen(t *testing.T) {
	ctx := context.Background()
	svc, terminals, reports, events := newReportingService(t, nil)
	session, err := svc.Create(ctx, app.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	if command := terminals.Launches[session.Target(0)].Command; !strings.HasPrefix(command, "/opt/runner pty --report "+session.ID+" -- ") {
		t.Fatalf("the agent does not run under the wrapper: %q", command)
	}
	_ = terminals.SendKeys(ctx, session.Target(0), workingScreen)

	reports.say(session.ID, "state=blocked:kind=permission:msg=YXBwcm92ZSBCYXNo")
	got, err := svc.Refresh(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.State != domain.StateBlocked || got.Program == nil || got.Program.Kind != "permission" || got.Program.Message != "approve Bash" {
		t.Fatalf("refresh saw %s %+v", got.State, got.Program)
	}
	if published := events.last(); published.Program == nil || published.Program.Kind != "permission" {
		t.Fatalf("the link was not told why: %+v", published.Program)
	}

	// The agent cleared what it said (it exits so): the screen speaks again.
	reports.say(session.ID, "state=clear")
	if got, _ := svc.Refresh(ctx, session.ID); got.State != domain.StateWorking || got.Program != nil {
		t.Fatalf("after clear: %s %+v", got.State, got.Program)
	}
}

// A new message on a session that stays blocked is news for the console,
// but not a new state: the clock that moves a blocked session to
// waiting-on-you keeps running.
func TestARewordedReportKeepsTheStatesClock(t *testing.T) {
	ctx := context.Background()
	clock := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	svc, _, reports, events := newReportingService(t, func() time.Time { return clock })
	session, err := svc.Create(ctx, app.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	reports.say(session.ID, "state=blocked:kind=question:msg=d2hpY2g/")
	first, _ := svc.Refresh(ctx, session.ID)
	// A blocked session is announced a second time once it has stayed so;
	// that is its own rule, out of the way before what is measured here.
	clock = clock.Add(time.Minute)
	_, _ = svc.Refresh(ctx, session.ID)
	before := events.count()

	reports.say(session.ID, "state=blocked:kind=question:progress=50:msg=d2hpY2g/")
	if _, _ = svc.Refresh(ctx, session.ID); events.count() != before {
		t.Fatal("progress alone published an event")
	}
	reports.say(session.ID, "state=blocked:kind=question:msg=d2hpY2ggb25lPw==")
	second, _ := svc.Refresh(ctx, session.ID)
	if events.count() != before+1 || second.Program.Message != "which one?" {
		t.Fatalf("a new message: %d events, %+v", events.count()-before, second.Program)
	}
	if !second.Updated.Equal(first.Updated) {
		t.Fatalf("the blocked clock restarted: %s → %s", first.Updated, second.Updated)
	}
}

// What a session's wrapper left is dropped with the session.
func TestAnEndedSessionForgetsItsReport(t *testing.T) {
	ctx := context.Background()
	svc, terminals, reports, _ := newReportingService(t, nil)
	session, err := svc.Create(ctx, app.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	reports.say(session.ID, "state=working")
	_ = terminals.Kill(ctx, session.TmuxName())
	if got, _ := svc.Refresh(ctx, session.ID); got.State != domain.StateStopped {
		t.Fatalf("state %s", got.State)
	}
	if _, ok := reports.Read(session.ID); ok {
		t.Fatal("a stopped session kept its report")
	}
}

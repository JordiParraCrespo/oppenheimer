package app_test

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Agents run agents: a session's agent starts helpers as sessions of its
// own, sends them work and hears back from them, through the runner on its
// host (`product/research/lessons-from-herdr.md`).

type family struct {
	svc       *app.Service
	children  *app.Children
	terminals *fake.Terminals
	reports   *heldReports
	parent    domain.Session
}

func newFamily(t *testing.T) family {
	t.Helper()
	terminals, places := fake.NewTerminals(), fake.NewPlaces()
	reports := &heldReports{reports: map[string]domain.ProgramReport{}}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: domain.Layout{Root: "/home/jordi/oppenheimer"}, ProgramStatus: reports,
	})
	if err != nil {
		t.Fatal(err)
	}
	parent, err := svc.Create(context.Background(), app.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	// The parent's checkout is a folder on the host, which a child may run in.
	places.Folders[parent.Cwd()] = true
	reports.say(parent.ID, "state=idle")
	children := app.NewChildren(app.ChildrenOptions{Sessions: svc, Terminals: terminals, ProgramStatus: reports})
	return family{svc: svc, children: children, terminals: terminals, reports: reports, parent: parent}
}

func (f family) child(t *testing.T, in app.DelegateInput) domain.Session {
	t.Helper()
	in.Parent = f.parent.ID
	if in.Task == "" {
		in.Task = "review src/x.go, read-only"
	}
	child, err := f.children.Delegate(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	return child
}

func (f family) state(t *testing.T, id string) domain.State {
	t.Helper()
	s, err := f.svc.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	return s.State
}

// A child runs beside its parent, in the parent's own checkout, with its task
// as its first message, and is recorded as the parent's.
func TestADelegatedChildRunsInItsParentsFolder(t *testing.T) {
	f := newFamily(t)
	child := f.child(t, app.DelegateInput{Agent: domain.AgentCodex})
	if child.Parent != f.parent.ID || child.Place != domain.PlaceFolder || child.Folder != f.parent.Cwd() {
		t.Fatalf("child %+v", child)
	}
	launched := f.terminals.Launches[child.Target(0)]
	if launched.Dir != f.parent.Cwd() || !strings.Contains(launched.Command, "review src/x.go") {
		t.Fatalf("launched %+v", launched)
	}
	if children := f.children.Of(f.parent.ID); len(children) != 1 || children[0].ID != child.ID {
		t.Fatalf("children %v", children)
	}
}

// A message is pasted and then submitted: an agent that reads an Enter
// arriving with the paste as part of it would never send it.
func TestTellPastesThenSubmits(t *testing.T) {
	f := newFamily(t)
	before := f.terminals.Screens[f.parent.Target(0)]
	go func() {
		// The agent picks the message up.
		time.Sleep(300 * time.Millisecond)
		f.reports.say(f.parent.ID, "state=working")
	}()
	told, err := f.children.Tell(context.Background(), f.parent.ID, "focus on the error path")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(f.terminals.PastesSoFar(), "focus on the error path") {
		t.Fatalf("pastes %q", f.terminals.PastesSoFar())
	}
	if got := strings.TrimPrefix(f.terminals.Screens[f.parent.Target(0)], before); got != "focus on the error path\r" {
		t.Fatalf("typed %q", got)
	}
	if told.Started == nil || !*told.Started {
		t.Fatalf("started %v", told.Started)
	}
}

// The parent hears when its child needs attention, in its own input, marked
// as the child's.
func TestAParentHearsWhenItsChildIsBlocked(t *testing.T) {
	f := newFamily(t)
	child := f.child(t, app.DelegateInput{})
	f.reports.say(child.ID, "state=blocked:kind=permission:msg=YXBwcm92ZSBCYXNo")
	if _, err := f.svc.Refresh(context.Background(), child.ID); err != nil {
		t.Fatal(err)
	}
	want := `<oppenheimer from="` + child.ID + `" state="blocked">permission: approve Bash</oppenheimer>`
	waitUntil(t, func() bool { return slices.Contains(f.terminals.PastesSoFar(), want) })

	quiet := f.child(t, app.DelegateInput{Quiet: true})
	f.reports.say(quiet.ID, "state=blocked:kind=question")
	_, _ = f.svc.Refresh(context.Background(), quiet.ID)
	time.Sleep(400 * time.Millisecond)
	for _, paste := range f.terminals.PastesSoFar() {
		if strings.Contains(paste, quiet.ID) {
			t.Fatalf("a quiet child sent a note: %q", paste)
		}
	}
}

// A child's own report reaches the parent marked as the child's.
func TestAChildReportsToItsParent(t *testing.T) {
	f := newFamily(t)
	child := f.child(t, app.DelegateInput{})
	go func() {
		time.Sleep(200 * time.Millisecond)
		f.reports.say(f.parent.ID, "state=working")
	}()
	if _, err := f.children.Report(context.Background(), child.ID, "two bugs, both in parse()"); err != nil {
		t.Fatal(err)
	}
	want := `<oppenheimer from="` + child.ID + `">two bugs, both in parse()</oppenheimer>`
	if !slices.Contains(f.terminals.PastesSoFar(), want) {
		t.Fatalf("pastes %q", f.terminals.PastesSoFar())
	}
	if _, err := f.children.Report(context.Background(), f.parent.ID, "x"); err == nil {
		t.Fatal("a session with no parent reported to one")
	}
}

// Children end with their parent, unless they were asked to outlive it.
func TestChildrenEndWithTheirParent(t *testing.T) {
	f := newFamily(t)
	child := f.child(t, app.DelegateInput{})
	keeper := f.child(t, app.DelegateInput{OutliveParent: true})
	if _, err := f.svc.Stop(context.Background(), f.parent.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.state(t, child.ID); got != domain.StateStopped {
		t.Fatalf("child is %s after its parent stopped", got)
	}
	if got := f.state(t, keeper.ID); !got.Live() {
		t.Fatalf("a child asked to outlive its parent is %s", got)
	}
}

// Waiting returns once a child that started work has finished it; a child
// that has not started yet is not finished.
func TestWaitReturnsOnceTheChildFinished(t *testing.T) {
	f := newFamily(t)
	child := f.child(t, app.DelegateInput{})
	f.reports.say(child.ID, "state=idle")

	short, cancel := context.WithTimeout(context.Background(), 600*time.Millisecond)
	_, err := f.children.Wait(short, f.parent.ID, nil)
	cancel()
	if err == nil {
		t.Fatal("a child that has not started counted as finished")
	}

	f.reports.say(child.ID, "state=working")
	_, _ = f.svc.Refresh(context.Background(), child.ID)
	go func() {
		time.Sleep(300 * time.Millisecond)
		f.reports.say(child.ID, "state=done:msg=ZG9uZQ==")
	}()
	got, err := f.children.Wait(context.Background(), f.parent.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].State != domain.StateDone {
		t.Fatalf("waited for %+v", got)
	}
}

func waitUntil(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

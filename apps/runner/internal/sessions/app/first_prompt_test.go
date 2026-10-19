package app_test

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const conversation = "3f1c2b8e-4a5d-4c6e-9f70-1a2b3c4d5e6f"

// typedTranscripts answers what has been typed into each conversation so far.
type typedTranscripts struct {
	mu    sync.Mutex
	typed map[string]string
}

func (t *typedTranscripts) FirstPrompt(_ domain.Agent, conversation string) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.typed[conversation]
}

func (t *typedTranscripts) typeInto(text string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.typed[conversation] = text
}

// promptRecorder is the link: it takes state changes and first prompts.
type promptRecorder struct {
	mu      sync.Mutex
	prompts []string
	// hold is how long taking a prompt takes, so passes at once overlap.
	hold time.Duration
}

func (r *promptRecorder) SessionChanged(domain.Session) {}

func (r *promptRecorder) FirstPrompt(_ domain.Session, text string) bool {
	time.Sleep(r.hold)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prompts = append(r.prompts, text)
	return true
}

func (r *promptRecorder) sent() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.prompts...)
}

type promptHarness struct {
	svc         *app.Service
	transcripts *typedTranscripts
	link        *promptRecorder
}

func newPromptHarness(t *testing.T, store app.Store, publisher app.Publisher) *promptHarness {
	t.Helper()
	transcripts := &typedTranscripts{typed: map[string]string{}}
	svc, err := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: store, Publisher: publisher, Transcripts: transcripts,
		Places: fake.NewPlaces(), Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
	})
	if err != nil {
		t.Fatal(err)
	}
	link, _ := publisher.(*promptRecorder)
	return &promptHarness{svc: svc, transcripts: transcripts, link: link}
}

func (h *promptHarness) open(t *testing.T, launch domain.Launch) domain.Session {
	t.Helper()
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude, Launch: launch,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

// poll is one tick of the runner's session loop.
func (h *promptHarness) poll(t *testing.T) {
	t.Helper()
	if _, err := h.svc.RefreshAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	h.svc.ReportFirstPrompts()
}

// A task typed into the terminal names the session: the first message is
// reported once, however many polls see it, and not again by a runner that
// restarts on the same session map, read back from disk.
func TestTheFirstMessageTypedIntoTheAgentIsReportedOnce(t *testing.T) {
	store := state.New(t.TempDir())
	h := newPromptHarness(t, store, &promptRecorder{})
	h.open(t, domain.Launch{Conversation: conversation})

	h.poll(t)
	if got := h.link.sent(); len(got) != 0 {
		t.Fatalf("reported %q before anything was typed", got)
	}

	h.transcripts.typeInto("  Fix the repo picker  ")
	h.poll(t)
	h.poll(t)
	if got := h.link.sent(); len(got) != 1 || got[0] != "Fix the repo picker" {
		t.Fatalf("reported %q, want the first message once", got)
	}

	restarted := newPromptHarness(t, store, &promptRecorder{})
	restarted.transcripts.typeInto("Fix the repo picker")
	restarted.poll(t)
	if got := restarted.link.sent(); len(got) != 0 {
		t.Fatalf("a restarted runner reported %q again", got)
	}
}

// Two passes at once (a slow tick overlapping the next) see the same
// waiting session; only one reports it.
func TestPassesAtOnceReportTheFirstMessageOnce(t *testing.T) {
	h := newPromptHarness(t, state.New(t.TempDir()), &promptRecorder{hold: 20 * time.Millisecond})
	h.open(t, domain.Launch{Conversation: conversation})
	h.transcripts.typeInto("Fix the repo picker")
	var passes sync.WaitGroup
	for range 8 {
		passes.Add(1)
		go func() {
			defer passes.Done()
			h.svc.ReportFirstPrompts()
		}()
	}
	passes.Wait()
	if got := h.link.sent(); len(got) != 1 {
		t.Fatalf("reported %q, want the first message once", got)
	}
}

// The composer's task is already the log's `prompt.first`, written by the
// control plane; a second one from the host would be a duplicate.
func TestALaunchThatCarriedATaskReportsNothing(t *testing.T) {
	h := newPromptHarness(t, state.New(t.TempDir()), &promptRecorder{})
	h.open(t, domain.Launch{Conversation: conversation, Prompt: "Fix the repo picker"})
	h.transcripts.typeInto("Fix the repo picker")
	h.poll(t)
	if got := h.link.sent(); len(got) != 0 {
		t.Fatalf("reported %q for a session the composer named", got)
	}
}

// Before the link exists there is nobody to tell, so nothing is marked
// reported: the first poll with a link still sends it.
func TestWithoutALinkTheFirstMessageWaits(t *testing.T) {
	store := state.New(t.TempDir())
	unlinked := newPromptHarness(t, store, app.NopPublisher{})
	unlinked.open(t, domain.Launch{Conversation: conversation})
	unlinked.transcripts.typeInto("Fix the repo picker")
	unlinked.poll(t)

	link := &promptRecorder{}
	unlinked.svc.SetPublisher(link)
	unlinked.poll(t)
	if got := link.sent(); len(got) != 1 {
		t.Fatalf("reported %q once linked, want the first message", got)
	}
}

// `prompt.first` carries at most 2 KB, and a cut never splits a character.
func TestALongFirstMessageIsCutToTheCap(t *testing.T) {
	h := newPromptHarness(t, state.New(t.TempDir()), &promptRecorder{})
	h.open(t, domain.Launch{Conversation: conversation})
	h.transcripts.typeInto(strings.Repeat("é", domain.FirstPromptMaxBytes))
	h.poll(t)
	got := h.link.sent()
	if len(got) != 1 || len(got[0]) > domain.FirstPromptMaxBytes || !utf8.ValidString(got[0]) {
		t.Fatalf("reported %d bytes (valid UTF-8: %t), want at most %d", len(got[0]), utf8.ValidString(got[0]), domain.FirstPromptMaxBytes)
	}
}

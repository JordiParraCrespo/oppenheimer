package cli

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// sentEvents is a link that takes every batch and keeps what it said; the
// control plane's ack is the test's to send (ackAll).
type sentEvents struct {
	mu      sync.Mutex
	events  []sentEvent
	batches []link.EventsAppend
}

type sentEvent struct {
	session, kind string
	payload       map[string]any
}

func (s *sentEvents) Send(message any) error {
	batch, ok := message.(link.EventsAppend)
	if !ok {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.batches = append(s.batches, batch)
	for _, event := range batch.Events {
		var payload map[string]any
		_ = json.Unmarshal([]byte(event.Payload), &payload)
		s.events = append(s.events, sentEvent{session: batch.SessionID, kind: event.Kind, payload: payload})
	}
	return nil
}

// ackAll is the control plane taking every batch sent so far.
func (s *sentEvents) ackAll(r *link.Reporter) {
	s.mu.Lock()
	batches := s.batches
	s.batches = nil
	s.mu.Unlock()
	for _, batch := range batches {
		keys := make([]string, 0, len(batch.Events))
		for _, event := range batch.Events {
			keys = append(keys, event.IdempotencyKey)
		}
		r.Ack(link.EventsAck{Type: "events.ack", BatchID: batch.BatchID, Accepted: keys})
	}
}

// take answers what was sent since the last take.
func (s *sentEvents) take() []sentEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.events
	s.events = nil
	return out
}

// fakeCodexCloud is Codex cloud as cloud.Codex answers it: the threads it
// was started with, and their status as the test sets it. refuse holds, by
// thread, what a status ask about it answers instead.
type fakeCodexCloud struct {
	mu      sync.Mutex
	threads []fakeThread
	asks    []string
	starts  []string
	refuse  map[string]error
}

// fakeThread is one thread the fake started, and where it stands.
type fakeThread struct{ ID, Status string }

func (f *fakeCodexCloud) Start(_ context.Context, repository, branch, prompt, environment string) (cloud.Started, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id := "thr_" + string(rune('a'+len(f.starts)))
	if environment != "" {
		repository += "[" + environment + "]"
	}
	f.starts = append(f.starts, repository+"@"+branch+": "+prompt)
	f.threads = append(f.threads, fakeThread{ID: id, Status: cloud.CodexPending})
	return cloud.Started{ID: id, URL: "codex://threads/" + id}, nil
}

func (f *fakeCodexCloud) Status(_ context.Context, threadID string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.asks = append(f.asks, threadID)
	if err := f.refuse[threadID]; err != nil {
		return "", err
	}
	for _, thread := range f.threads {
		if thread.ID == threadID {
			return thread.Status, nil
		}
	}
	return cloud.CodexPending, nil
}

func (f *fakeCodexCloud) set(id, status string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := range f.threads {
		if f.threads[i].ID == id {
			f.threads[i].Status = status
		}
	}
}

func newCodexCloudHarness(t *testing.T) (*linkHandler, *fakeCodexCloud, *sentEvents) {
	t.Helper()
	codex := &fakeCodexCloud{}
	sent := &sentEvents{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := &linkHandler{
		app:    &App{Paths: Paths{Home: t.TempDir()}, CodexCloud: codex},
		logger: logger, life: context.Background(),
	}
	h.reporter = link.NewReporter("run-test", sent, logger)
	return h, codex, sent
}

func codexCreate(sessionID string) link.SessionCreate {
	return link.SessionCreate{
		Type: "session.create", CommandID: "c-" + sessionID, SessionID: sessionID, Agent: codexCloudAgent,
		Prompt: "Fix the wallet list",
		Checkouts: []link.Checkout{{
			CheckoutID: "k-1", GithubRepoID: 42, RepositoryFullName: "acme-labs/xrp-mobile", BaseBranch: "develop",
		}},
		Cloud: &link.SessionCreateCloud{Sealed: "unused"},
	}
}

func kinds(events []sentEvent) []string {
	out := []string{}
	for _, event := range events {
		if event.kind != link.SessionStepKind {
			out = append(out, event.kind+":"+stateOf(event))
		}
	}
	return out
}

func stateOf(event sentEvent) string {
	if state, ok := event.payload["state"].(string); ok {
		return state
	}
	if id, ok := event.payload["agentSessionId"].(string); ok {
		return id
	}
	return ""
}

// The host starts the task on the checkout's base branch, in the
// repository's environment, with nothing cloned, and reports the task as the
// session's and the session as working, the moment Codex has it.
func TestACodexCloudCreateStartsTheTaskAndReportsItWorking(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	h.createCloud(context.Background(), codexCreate("s-1"))

	if len(codex.starts) != 1 || codex.starts[0] != "acme-labs/xrp-mobile@develop: Fix the wallet list" {
		t.Fatalf("starts = %q", codex.starts)
	}
	got := kinds(sent.take())
	want := []string{"session.started:thr_a", "agent.observed:working"}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("events = %q, want %q", got, want)
	}

	// Sent again (a hello after a lost report), it reports the task it made.
	h.cloudStarts.Delete("s-1")
	h.createCloud(context.Background(), codexCreate("s-1"))
	if len(codex.starts) != 1 {
		t.Fatalf("a create sent again started another task: %q", codex.starts)
	}
	if got := kinds(sent.take()); len(got) != 1 || got[0] != "session.started:thr_a" {
		t.Fatalf("events = %q", got)
	}
}

// A poll reports a status once, when it moves: done when the task finished,
// failed when it failed, and nothing at all once every task has settled.
func TestTheCodexCloudPollReportsEachTaskOnceWhenItMoves(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	h.createCloud(context.Background(), codexCreate("s-1"))
	h.createCloud(context.Background(), codexCreate("s-2"))
	sent.take()
	sent.ackAll(h.reporter)

	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := sent.take(); len(got) != 0 {
		t.Fatalf("an unmoved task was reported: %+v", got)
	}

	codex.set("thr_a", cloud.CodexReady)
	codex.set("thr_b", cloud.CodexError)
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	reported := map[string]string{}
	for _, event := range sent.take() {
		reported[event.session] = event.kind + ":" + stateOf(event)
	}
	if reported["s-1"] != "agent.observed:done" || reported["s-2"] != "session.failed:" {
		t.Fatalf("reported = %v", reported)
	}
	sent.ackAll(h.reporter)

	asks := len(codex.asks)
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(codex.asks) != asks {
		t.Fatalf("Codex was asked again with every task settled")
	}
}

// One thread Codex will not answer about (archived, deleted) is skipped: the
// others are still read and reported, and the round says it missed one.
func TestTheCodexCloudPollSkipsAThreadItCannotRead(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	h.createCloud(context.Background(), codexCreate("s-1"))
	h.createCloud(context.Background(), codexCreate("s-2"))
	sent.take()
	sent.ackAll(h.reporter)

	codex.refuse = map[string]error{"thr_a": sessionsdomain.ErrCodexCloudStart.WithDetail("thread not found")}
	codex.set("thr_b", cloud.CodexReady)
	if err := h.pollCodexCloud(context.Background()); err == nil {
		t.Fatal("a round that missed a thread reported no error")
	}
	if got := kinds(sent.take()); len(got) != 1 || got[0] != "agent.observed:done" {
		t.Fatalf("events = %q, want the readable thread reported", got)
	}
}

// ChatGPT's "wait", or a refused sign-in, ends the round at once: every other
// ask would meet it too.
func TestTheCodexCloudPollStopsWhenChatGPTSaysWait(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	h.createCloud(context.Background(), codexCreate("s-1"))
	h.createCloud(context.Background(), codexCreate("s-2"))
	sent.take()

	wait := sessionsdomain.ErrCodexRateLimited.WithDetail("try again in 1m0s")
	codex.refuse = map[string]error{"thr_a": wait, "thr_b": wait}
	if err := h.pollCodexCloud(context.Background()); err == nil {
		t.Fatal("a refused round reported no error")
	}
	if len(codex.asks) != 1 {
		t.Fatalf("asks = %q, want one", codex.asks)
	}
}

// A legacy task, left unsettled by a runner that drove `codex cloud`, is not
// asked about: the current service does not know it, and asking every minute
// would only be refused.
func TestTheCodexCloudPollLeavesALegacyTaskAlone(t *testing.T) {
	h, codex, _ := newCodexCloudHarness(t)
	ledger := newCloudLedger(h.app.Paths.State())
	if err := ledger.record("s-old", codexCloudAgent, cloud.Started{ID: "task_e_68a1"}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(codex.asks) != 0 {
		t.Fatalf("asks = %q, want none", codex.asks)
	}
}

// With no Codex thread to watch, Codex is not asked.
func TestTheCodexCloudPollAsksNothingWithNothingToWatch(t *testing.T) {
	h, codex, _ := newCodexCloudHarness(t)
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(codex.asks) != 0 {
		t.Fatalf("asks = %q, want none", codex.asks)
	}
}

// A status reported while the link is down waits in memory; until the
// control plane acks it, the ledger still holds the last one it took. A
// runner that restarts before the ack reports it again rather than taking
// the task for settled, and one that keeps running sends it only once.
func TestACodexStatusIsRememberedOnlyOnceTheControlPlaneTookIt(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	h.createCloud(context.Background(), codexCreate("s-1"))
	sent.ackAll(h.reporter)
	sent.take()

	codex.set("thr_a", cloud.CodexReady)
	for range 2 {
		if err := h.pollCodexCloud(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if got := kinds(sent.take()); len(got) != 1 || got[0] != "agent.observed:done" {
		t.Fatalf("events before the ack = %q, want done once", got)
	}

	// The runner restarts with that event unacked: a new handler, the same ledger.
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	again := &sentEvents{}
	restarted := &linkHandler{app: h.app, logger: logger, life: context.Background()}
	restarted.reporter = link.NewReporter("run-test-2", again, logger)
	if err := restarted.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := kinds(again.take()); len(got) != 1 || got[0] != "agent.observed:done" {
		t.Fatalf("events after the restart = %q, want done again", got)
	}

	// Taken this time: the task is settled, and Codex is not asked again.
	again.ackAll(restarted.reporter)
	asks := len(codex.asks)
	if err := restarted.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(codex.asks) != asks {
		t.Fatal("Codex was asked about a task whose finish the control plane took")
	}
}

// The environment the person picked is the one the task starts in.
func TestACodexCloudCreateStartsInThePickedEnvironment(t *testing.T) {
	h, codex, _ := newCodexCloudHarness(t)
	create := codexCreate("s-1")
	create.CodexEnvironment = "asenvcfg_web"
	h.createCloud(context.Background(), create)

	if len(codex.starts) != 1 || codex.starts[0] != "acme-labs/xrp-mobile[asenvcfg_web]@develop: Fix the wallet list" {
		t.Fatalf("starts = %q", codex.starts)
	}
}

type sentMessages struct {
	mu   sync.Mutex
	sent []any
}

func (s *sentMessages) Send(message any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, message)
	return nil
}

func (s *sentMessages) SendFrame(context.Context, uint32, []byte) error { return nil }

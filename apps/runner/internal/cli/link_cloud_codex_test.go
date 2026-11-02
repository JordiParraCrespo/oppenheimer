package cli

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
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

// fakeCodexCloud is Codex cloud as the CLI answers it: the tasks it was
// started with, their status as the test sets it, newest first, a page of
// pageSize at a time.
type fakeCodexCloud struct {
	mu       sync.Mutex
	tasks    []cloud.CodexTask
	pageSize int
	lists    int
	starts   []string
}

func (f *fakeCodexCloud) Start(_ context.Context, repository, branch, prompt, environment string) (cloud.Started, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id := "task_e_" + string(rune('a'+len(f.starts)))
	if environment != "" {
		repository += "[" + environment + "]"
	}
	f.starts = append(f.starts, repository+"@"+branch+": "+prompt)
	f.tasks = append([]cloud.CodexTask{{ID: id, Status: cloud.CodexPending}}, f.tasks...)
	return cloud.Started{ID: id, URL: "https://chatgpt.com/codex/tasks/" + id}, nil
}

func (f *fakeCodexCloud) List(_ context.Context, cursor string) (cloud.CodexPage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lists++
	from := 0
	if cursor != "" {
		_ = json.Unmarshal([]byte(cursor), &from)
	}
	to := min(from+f.pageSize, len(f.tasks))
	page := cloud.CodexPage{Tasks: append([]cloud.CodexTask(nil), f.tasks[from:to]...)}
	if to < len(f.tasks) {
		page.Cursor = string(must(json.Marshal(to)))
	}
	return page, nil
}

func (f *fakeCodexCloud) Environments(_ context.Context, repository string) (cloud.CodexEnvironments, error) {
	return cloud.CodexEnvironments{
		Environments: []cloud.CodexEnvironment{
			{ID: "e_linked", Label: "Wallet app", Pinned: true, Repository: repository == "acme-labs/xrp-mobile"},
			{ID: "e_other"},
		},
		Recommended: "e_linked", Source: cloud.CodexSourceChatGPT,
	}, nil
}

func (f *fakeCodexCloud) set(id, status string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := range f.tasks {
		if f.tasks[i].ID == id {
			f.tasks[i].Status = status
		}
	}
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func newCodexCloudHarness(t *testing.T) (*linkHandler, *fakeCodexCloud, *sentEvents) {
	t.Helper()
	codex := &fakeCodexCloud{pageSize: 20}
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
	want := []string{"session.started:task_e_a", "agent.observed:working"}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("events = %q, want %q", got, want)
	}

	// Sent again (a hello after a lost report), it reports the task it made.
	h.cloudStarts.Delete("s-1")
	h.createCloud(context.Background(), codexCreate("s-1"))
	if len(codex.starts) != 1 {
		t.Fatalf("a create sent again started another task: %q", codex.starts)
	}
	if got := kinds(sent.take()); len(got) != 1 || got[0] != "session.started:task_e_a" {
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

	codex.set("task_e_a", cloud.CodexReady)
	codex.set("task_e_b", cloud.CodexError)
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

	lists := codex.lists
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if codex.lists != lists {
		t.Fatalf("Codex was asked again with every task settled")
	}
}

// A task behind other ones the account started elsewhere is found on a
// later page.
func TestTheCodexCloudPollPagesToATaskFurtherBack(t *testing.T) {
	h, codex, sent := newCodexCloudHarness(t)
	codex.pageSize = 1
	h.createCloud(context.Background(), codexCreate("s-1"))
	for range 3 {
		_, _ = codex.Start(context.Background(), "acme-labs/web", "main", "elsewhere", "")
	}
	sent.take()

	codex.set("task_e_a", cloud.CodexApplied)
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := kinds(sent.take()); len(got) != 1 || got[0] != "agent.observed:done" {
		t.Fatalf("events = %q", got)
	}
}

// With no Codex task to watch, the CLI is never run.
func TestTheCodexCloudPollAsksNothingWithNothingToWatch(t *testing.T) {
	h, codex, _ := newCodexCloudHarness(t)
	if err := h.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if codex.lists != 0 {
		t.Fatalf("lists = %d, want 0", codex.lists)
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

	codex.set("task_e_a", cloud.CodexReady)
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
	lists := codex.lists
	if err := restarted.pollCodexCloud(context.Background()); err != nil {
		t.Fatal(err)
	}
	if codex.lists != lists {
		t.Fatal("Codex was asked about a task whose finish the control plane took")
	}
}

// The environment the person picked is the one the task starts in.
func TestACodexCloudCreateStartsInThePickedEnvironment(t *testing.T) {
	h, codex, _ := newCodexCloudHarness(t)
	create := codexCreate("s-1")
	create.CodexEnvironment = "e_other"
	h.createCloud(context.Background(), create)

	if len(codex.starts) != 1 || codex.starts[0] != "acme-labs/xrp-mobile[e_other]@develop: Fix the wallet list" {
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

// `codex.environments.list` is answered with the account's environments under
// the command's id, the linked one marked and recommended.
func TestCodexEnvironmentsAreListedForTheComposer(t *testing.T) {
	h, _, _ := newCodexCloudHarness(t)
	client := &sentMessages{}
	h.client = client
	h.listCodexEnvironments(context.Background(), link.CodexEnvironmentsList{
		Type: link.TypeCodexEnvironmentsList, CommandID: "c-1", Repository: "acme-labs/xrp-mobile",
	})

	if len(client.sent) != 1 {
		t.Fatalf("sent = %+v", client.sent)
	}
	got, ok := client.sent[0].(link.CodexEnvironments)
	if !ok || got.CommandID != "c-1" || got.Recommended != "e_linked" || got.Source != "chatgpt" ||
		len(got.Environments) != 2 || !got.Environments[0].Repository || got.Environments[1].Repository {
		t.Fatalf("answer = %+v", client.sent[0])
	}
}

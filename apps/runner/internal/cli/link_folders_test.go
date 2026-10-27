package cli

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"testing"
	"time"

	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/folders"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// placesHarness is a handler on a link that is up, over in-memory tmux, git
// and places, with the host's real folder listing rooted at home, for a host
// paired with account (empty: an identity from before pairing named one).
type placesHarness struct {
	h         *linkHandler
	sent      *capturedLink
	svc       *sessionsapp.Service
	worktrees *fake.Worktrees
	places    *fake.Places
	terminals *fake.Terminals
}

func newPlacesHarness(t *testing.T, home, account string) *placesHarness {
	t.Helper()
	terminals, worktrees, places := fake.NewTerminals(), fake.NewWorktrees(), fake.NewPlaces()
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: worktrees, Places: places, Classifier: manifest.New(manifest.Options{}),
		Layout: sessionsdomain.Layout{Root: "/home/jordi/oppenheimer"},
	})
	if err != nil {
		t.Fatal(err)
	}
	prober := hostfake.New()
	prober.Home = home
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{
			Sessions: svc,
			Host:     hostapp.New(hostapp.Options{Prober: prober, Directories: folders.Disk{}}),
		},
		identity: pairdomain.Identity{HostID: "host-1", AccountID: account},
		logger:   logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(time.Second) })
	h.Connected(context.Background(), 1)
	return &placesHarness{h: h, sent: sent, svc: svc, worktrees: worktrees, places: places, terminals: terminals}
}

// events is every event the reporter sent for the session, kind by kind.
func (p *placesHarness) events(sessionID string) []link.Event {
	p.sent.mu.Lock()
	defer p.sent.mu.Unlock()
	var out []link.Event
	for _, message := range p.sent.sent {
		if batch, ok := message.(link.EventsAppend); ok && batch.SessionID == sessionID {
			out = append(out, batch.Events...)
		}
	}
	return out
}

// A folder session from the console (24 §3): nothing cloned, no checkout to
// report, and the steps the console shows are the host and the agent only.
func TestALinkedFolderSessionStartsWithNoCheckouts(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	p.places.SetFolder("/home/jordi/code/site", true)

	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "site",
		"folder": "/home/jordi/code/site", "checkouts": []any{}, "cwdCheckoutId": nil,
	}))
	session := waitForState(t, p.svc, sessionsdomain.StateStarting)

	if session.Place != sessionsdomain.PlaceFolder || session.Cwd() != "/home/jordi/code/site" {
		t.Fatalf("session = %+v", session)
	}
	if len(p.worktrees.Mirrors) != 0 || len(p.places.Sessions) != 0 {
		t.Fatal("a folder session made a store or a session folder")
	}
	var steps []string
	var started map[string]any
	for _, event := range p.events(sessionUnderTest) {
		switch event.Kind {
		case link.SessionStepKind:
			var step link.SessionStepPayload
			_ = json.Unmarshal([]byte(event.Payload), &step)
			if step.Status == link.SessionStepDone {
				steps = append(steps, string(step.Step))
			}
		case "session.started":
			_ = json.Unmarshal([]byte(event.Payload), &started)
		}
	}
	if !slices.Equal(steps, []string{string(link.SessionStepHost), string(link.SessionStepAgent)}) {
		t.Fatalf("steps = %v, want host and agent", steps)
	}
	if checkouts, ok := started["checkouts"].([]any); !ok || len(checkouts) != 0 {
		t.Fatalf("session.started = %v, want no checkouts", started)
	}
}

// A worktree session lands under the account the host was paired with and
// the frame's workspace, in a folder named by its slug, its checkout named by
// the frame (24 §2).
func TestALinkedWorktreeSessionLandsInItsWorkspace(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")

	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "bright-lark",
		"branch": "oppenheimer/bright-lark", "cwdCheckoutId": "c-1",
		"checkouts": []map[string]any{{
			"checkoutId": "c-1", "githubRepoId": 42, "repositoryFullName": "acme-labs/xrp-mobile",
			"directoryName": "mobile", "baseBranch": "develop",
		}},
	}))
	session := waitForState(t, p.svc, sessionsdomain.StateStarting)

	dir := "/home/jordi/oppenheimer/acct/ws/sessions/bright-lark"
	if session.Dir != dir || session.Worktree != filepath.Join(dir, "mobile") {
		t.Fatalf("dir %q worktree %q", session.Dir, session.Worktree)
	}
	if p.places.Sessions[dir] != sessionUnderTest || p.places.Slugs[dir] != "acme" {
		t.Fatalf("places = %v %v", p.places.Sessions, p.places.Slugs)
	}
	if p.worktrees.Stores["acct/ws/acme-labs/xrp-mobile"] != 1 {
		t.Fatalf("stores = %v", p.worktrees.Stores)
	}
}

// A session over two repositories lands both checkouts in its folder, makes
// a store of each, and reports both as it starts, each at its own path on
// the session's one branch, the agent's own first.
func TestALinkedSessionOverTwoRepositoriesReportsBothCheckouts(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")

	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "bright-lark",
		"branch": "oppenheimer/bright-lark", "cwdCheckoutId": "c-2",
		"checkouts": []map[string]any{
			{"checkoutId": "c-1", "githubRepoId": 42, "repositoryFullName": "acme-labs/xrp-mobile",
				"directoryName": "mobile", "baseBranch": "develop"},
			{"checkoutId": "c-2", "githubRepoId": 43, "repositoryFullName": "acme-labs/xrp-api",
				"directoryName": "api", "baseBranch": "main"},
		},
	}))
	session := waitForState(t, p.svc, sessionsdomain.StateStarting)

	dir := "/home/jordi/oppenheimer/acct/ws/sessions/bright-lark"
	if session.Cwd() != dir || session.Worktree != filepath.Join(dir, "api") {
		t.Fatalf("cwd %q, first worktree %q", session.Cwd(), session.Worktree)
	}
	if p.worktrees.Stores["acct/ws/acme-labs/xrp-mobile"] != 1 || p.worktrees.Stores["acct/ws/acme-labs/xrp-api"] != 1 {
		t.Fatalf("stores = %v", p.worktrees.Stores)
	}
	var started struct {
		Checkouts []map[string]string `json:"checkouts"`
	}
	for _, event := range p.events(sessionUnderTest) {
		if event.Kind == "session.started" {
			_ = json.Unmarshal([]byte(event.Payload), &started)
		}
	}
	want := []map[string]string{
		{"checkoutId": "c-2", "branch": "oppenheimer/bright-lark", "path": filepath.Join(dir, "api"), "mode": "worktree"},
		{"checkoutId": "c-1", "branch": "oppenheimer/bright-lark", "path": filepath.Join(dir, "mobile"), "mode": "worktree"},
	}
	if !reflect.DeepEqual(started.Checkouts, want) {
		t.Fatalf("session.started checkouts = %v, want %v", started.Checkouts, want)
	}
}

// An identity paired before registration answered an account names the work
// folder's top level by the host's own id, which never changes either.
func TestALinkedSessionFromAnIdentityWithNoAccountLandsUnderTheHost(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "")

	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "bright-lark",
		"branch": "oppenheimer/bright-lark", "cwdCheckoutId": "c-1",
		"checkouts": []map[string]any{{
			"checkoutId": "c-1", "githubRepoId": 42, "repositoryFullName": "acme-labs/xrp-mobile",
			"directoryName": "mobile", "baseBranch": "develop",
		}},
	}))
	session := waitForState(t, p.svc, sessionsdomain.StateStarting)

	if want := "/home/jordi/oppenheimer/host-1/ws/sessions/bright-lark"; session.Dir != want {
		t.Fatalf("dir %q, want %q", session.Dir, want)
	}
}

// A folder that went away between the picker and the create is refused with
// its own code, and nothing is started.
func TestALinkedFolderSessionWhoseFolderIsGoneIsRefused(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	const commandID = "11111111-1111-4111-8111-111111111111"

	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": commandID, "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "site",
		"folder": "/home/jordi/gone", "checkouts": []any{}, "cwdCheckoutId": nil,
	}))

	failed := p.sent.waitFor(t, "command.failed", isCommandFailed(commandID)).(link.CommandFailed)
	if failed.Code != sessionsdomain.ErrFolderMissing.Code {
		t.Fatalf("code = %s, want %s", failed.Code, sessionsdomain.ErrFolderMissing.Code)
	}
	if names, _ := p.terminals.List(context.Background()); len(names) != 0 {
		t.Fatalf("a terminal was started: %v", names)
	}
}

// `fs.list` is answered with `fs.listing` for the command that asked: the
// home directory when no path is given, directories only.
func TestFsListIsAnsweredWithTheListing(t *testing.T) {
	home := t.TempDir()
	if err := os.MkdirAll(filepath.Join(home, "code", ".git"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, "code", ".git", "HEAD"), []byte("ref: refs/heads/main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, "notes.txt"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	p := newPlacesHarness(t, home, "acct")
	const commandID = "44444444-4444-4444-8444-444444444444"

	p.h.Message(context.Background(), message(t, link.TypeFsList, map[string]any{"commandId": commandID}))

	listing := p.sent.waitFor(t, "fs.listing", func(m any) bool {
		l, ok := m.(link.FsListing)
		return ok && l.CommandID == commandID
	}).(link.FsListing)
	if listing.Type != link.TypeFsListing || listing.Path != home || listing.Home != home ||
		listing.Parent == nil || *listing.Parent != filepath.Dir(home) {
		t.Fatalf("listing = %+v", listing)
	}
	if len(listing.Entries) != 1 || listing.Entries[0] != (link.FsListingEntries{Name: "code", Branch: "main"}) {
		t.Fatalf("entries = %+v", listing.Entries)
	}
}

func TestFsListOfAMissingFolderFailsWithFS001(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	const commandID = "55555555-5555-4555-8555-555555555555"

	p.h.Message(context.Background(), message(t, link.TypeFsList, map[string]any{
		"commandId": commandID, "path": "/no/such/folder",
	}))

	failed := p.sent.waitFor(t, "command.failed", isCommandFailed(commandID)).(link.CommandFailed)
	if failed.Code != "FS_001" {
		t.Fatalf("code = %s, want FS_001", failed.Code)
	}
}

// The hello says this runner takes folder sessions and lists folders, so the
// control plane sends it both (24 §5).
func TestTheHelloOffersFolderSessionsAndFolderListing(t *testing.T) {
	h := &linkHandler{}
	got := h.capabilities()
	for _, want := range []string{link.CapabilitySessionFolder, link.CapabilityFsList} {
		if !slices.Contains(got, want) {
			t.Fatalf("capabilities = %v, missing %s", got, want)
		}
	}
}

// A folder session's folder is the person's, and so is its git: its shell is
// not pointed at the runner's credential helper, which would hand a session
// token to whatever repository the folder is (24 §3). A worktree session's is.
func TestOnlyAWorktreeSessionsShellAsksTheRunnerForCredentials(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	folder := sessionEnv(paths, sessionsdomain.Session{ID: "s1", Place: sessionsdomain.PlaceFolder, Folder: "/home/jordi/code"})
	worktree := sessionEnv(paths, sessionsdomain.Session{ID: "s2", Place: sessionsdomain.PlaceWorktree, Repo: "jordi/oppenheimer"})

	if folder["OPPENHEIMER_SESSION"] != "s1" || folder["OPPENHEIMER_SOCKET"] != paths.Socket() {
		t.Fatalf("folder env = %v", folder)
	}
	for key := range folder {
		if key != "OPPENHEIMER_SESSION" && key != "OPPENHEIMER_SOCKET" {
			t.Fatalf("a folder session's shell carries %s", key)
		}
	}
	if worktree["GIT_CONFIG_KEY_0"] != "credential.https://github.com.helper" || worktree["OPPENHEIMER_REPO"] != "jordi/oppenheimer" {
		t.Fatalf("worktree env = %v", worktree)
	}
}

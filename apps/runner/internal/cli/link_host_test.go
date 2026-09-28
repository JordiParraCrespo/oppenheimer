package cli

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	upddomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

// capturedLink is the link as the handler writes to it, recording every
// control frame.
type capturedLink struct {
	mu   sync.Mutex
	sent []any
}

func (c *capturedLink) Send(message any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sent = append(c.sent, message)
	return nil
}

func (*capturedLink) SendFrame(context.Context, uint32, []byte) error { return nil }

// waitFor polls until one sent frame matches, and returns it.
func (c *capturedLink) waitFor(t *testing.T, what string, match func(any) bool) any {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		c.mu.Lock()
		for _, message := range c.sent {
			if match(message) {
				c.mu.Unlock()
				return message
			}
		}
		c.mu.Unlock()
		if time.Now().After(deadline) {
			t.Fatalf("no %s was sent", what)
		}
		time.Sleep(time.Millisecond)
	}
}

func isHeartbeat(message any) bool {
	beat, ok := message.(link.Heartbeat)
	return ok && beat.Type == "heartbeat"
}

func isCommandFailed(commandID string) func(any) bool {
	return func(message any) bool {
		failed, ok := message.(link.CommandFailed)
		return ok && failed.CommandID == commandID
	}
}

// heldDownload is a release whose download waits to be released: a slow
// connection, as far as the handler can tell.
type heldDownload struct {
	entered chan context.Context
	release chan struct{}
}

var errDownloadBroke = errors.New("the download broke")

func (b *heldDownload) Stage(ctx context.Context, _ upddomain.Artifact, _ string) (string, error) {
	b.entered <- ctx
	<-b.release
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return "", errDownloadBroke
}

func (*heldDownload) SelfCheck(context.Context, string) error { return nil }
func (*heldDownload) Promote(string, string) error            { return nil }
func (*heldDownload) Activate(string) error                   { return nil }
func (*heldDownload) Current() (string, error)                { return "1.0.0", nil }
func (*heldDownload) Prune(...string) error                   { return nil }

type offeredRelease struct{}

func (offeredRelease) Fetch(context.Context, string) (upddomain.Release, error) {
	return upddomain.Release{Channel: "stable", Version: "1.1.0", Artifact: upddomain.Artifact{URL: "https://example.test/r.tar.gz"}}, nil
}

type memoryUpdateState struct {
	mu    sync.Mutex
	state upddomain.State
}

func (m *memoryUpdateState) Load() (upddomain.State, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state, nil
}

func (m *memoryUpdateState) Save(s upddomain.State) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state = s
	return nil
}

// countingProber is a healthy host that counts how often it is collected.
type countingProber struct {
	*hostfake.Prober
	collects atomic.Int32
}

func (p *countingProber) Platform(ctx context.Context) (hostdomain.Platform, string, error) {
	p.collects.Add(1)
	return p.Prober.Platform(ctx)
}

func newHostHarness(t *testing.T) (*linkHandler, *capturedLink, *heldDownload, *countingProber) {
	t.Helper()
	h, _, _, _ := newCreateHarness(t)
	sent := &capturedLink{}
	h.client = sent
	download := &heldDownload{entered: make(chan context.Context, 4), release: make(chan struct{})}
	h.app.Updates = updapp.New(updapp.Options{
		Releases: offeredRelease{}, Binaries: download, State: &memoryUpdateState{},
		Version: "1.0.0", Channel: "stable",
	})
	prober := &countingProber{Prober: hostfake.New()}
	h.app.Host = hostapp.New(hostapp.Options{Prober: prober, Version: "1.0.0"})
	t.Cleanup(func() {
		select {
		case <-download.release:
		default:
			close(download.release)
		}
		h.lanes.close(time.Second)
	})
	return h, sent, download, prober
}

const updateCommand = "44444444-4444-4444-8444-444444444444"

func hostUpdate(t *testing.T) link.Message {
	return message(t, "host.update", map[string]any{"commandId": updateCommand})
}

// A download takes as long as the connection makes it. While it runs, the read
// loop must go on reading — that is where the pongs arrive — or the link
// drops, and the download with it.
func TestHostUpdateDoesNotBlockTheReadLoop(t *testing.T) {
	h, _, download, _ := newHostHarness(t)

	returned := make(chan struct{})
	go func() {
		h.Message(context.Background(), hostUpdate(t))
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(50 * time.Millisecond):
		t.Fatal("Message waited on the update")
	}
	select {
	case <-download.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("the update never started")
	}
}

// The link the update was asked on may drop mid-download; the download runs
// on the daemon's context and finishes anyway, and its outcome goes out on
// the link that is up when it does.
func TestHostUpdateSurvivesTheLinkContextEnding(t *testing.T) {
	h, sent, download, _ := newHostHarness(t)
	linkCtx, dropLink := context.WithCancel(context.Background())
	h.Message(linkCtx, hostUpdate(t))
	dropLink()

	var stageCtx context.Context
	select {
	case stageCtx = <-download.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("the update never started")
	}
	if err := stageCtx.Err(); err != nil {
		t.Fatalf("the download's context ended with the link: %v", err)
	}
	close(download.release)

	failed := sent.waitFor(t, "command.failed for the update", isCommandFailed(updateCommand)).(link.CommandFailed)
	if failed.Code == "" || failed.Detail == "" {
		t.Fatalf("the update's failure carries no reason: %+v", failed)
	}
}

func TestPreflightCollectsOnce(t *testing.T) {
	h, sent, _, prober := newHostHarness(t)

	h.Message(context.Background(), message(t, "host.preflight", map[string]any{"commandId": "p-1"}))

	beat := sent.waitFor(t, "heartbeat", isHeartbeat).(link.Heartbeat)
	if beat.Host.Platform != hostdomain.PlatformUbuntu {
		t.Fatalf("the heartbeat carries %+v, want the collected facts", beat.Host)
	}
	if n := prober.collects.Load(); n != 1 {
		t.Fatalf("a preflight collected the host %d times, want 1", n)
	}
}

// A preflight asked while an update downloads answers at once: the two do not
// share a lane.
func TestPreflightIsNotQueuedBehindAnUpdate(t *testing.T) {
	h, sent, download, _ := newHostHarness(t)
	h.Message(context.Background(), hostUpdate(t))
	select {
	case <-download.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("the update never started")
	}

	h.Message(context.Background(), message(t, "host.preflight", map[string]any{"commandId": "p-1"}))

	sent.waitFor(t, "heartbeat while the update was still running", isHeartbeat)
}

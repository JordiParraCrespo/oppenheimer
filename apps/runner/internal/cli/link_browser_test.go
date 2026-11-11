package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/policyfile"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

const browserCommandID = "66666666-6666-4666-8666-666666666666"

type browserHarness struct {
	h        *linkHandler
	sent     *capturedLink
	policy   policyfile.Browser
	browsers *hostfake.Browsers
}

func newBrowserHarness(t *testing.T, browsers *hostfake.Browsers) *browserHarness {
	t.Helper()
	policy := policyfile.Browser{Path: filepath.Join(t.TempDir(), "browser.json")}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{Host: hostapp.New(hostapp.Options{
			Prober: hostfake.New(), BrowserPolicies: policy, Browsers: browsers,
		})},
		identity: pairdomain.Identity{HostID: "host-1", AccountID: "acct"},
		logger:   logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(5 * time.Second) })
	h.Connected(context.Background(), 1)
	return &browserHarness{h: h, sent: sent, policy: policy, browsers: browsers}
}

func (b *browserHarness) on(t *testing.T) {
	t.Helper()
	if err := b.policy.Save(hostdomain.BrowserPolicy{Enabled: true}); err != nil {
		t.Fatal(err)
	}
}

func (b *browserHarness) act(t *testing.T, fields map[string]any) {
	t.Helper()
	body := map[string]any{"commandId": browserCommandID, "browser": "juno"}
	for key, value := range fields {
		body[key] = value
	}
	b.h.Message(context.Background(), message(t, "browser.act", body))
}

func (b *browserHarness) pages(commandID string) []link.BrowserPage {
	b.sent.mu.Lock()
	defer b.sent.mu.Unlock()
	var pages []link.BrowserPage
	for _, sent := range b.sent.sent {
		if page, ok := sent.(link.BrowserPage); ok && page.CommandID == commandID {
			pages = append(pages, page)
		}
	}
	return pages
}

func (b *browserHarness) waitPages(t *testing.T, commandID string, count int) []link.BrowserPage {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if pages := b.pages(commandID); len(pages) >= count {
			return pages
		}
		if time.Now().After(deadline) {
			t.Fatalf("fewer than %d browser.page frames for %s", count, commandID)
		}
		time.Sleep(time.Millisecond)
	}
}

// A host nobody set up opens no browser: off is the default, so pairing a
// machine never lets a bot browse from it.
func TestAHostOpensNoBrowserUntilItsOwnerTurnsItOn(t *testing.T) {
	b := newBrowserHarness(t, &hostfake.Browsers{})
	b.act(t, map[string]any{"action": "open", "url": "https://example.com"})

	failed := b.sent.waitFor(t, "command.failed", isCommandFailed(browserCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrBrowserOff.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrBrowserOff.Code)
	}
	if acted := b.browsers.Acted(); len(acted) != 0 {
		t.Fatalf("a refused action reached a browser: %+v", acted)
	}
}

// The page a bot gets back is the browser's: where it is, what can be acted
// on, and a retry of the same command is answered without acting again.
func TestABrowserActionAnswersThePageAndARetryDoesNotActAgain(t *testing.T) {
	browsers := &hostfake.Browsers{Page: hostdomain.BrowserPage{
		URL: "https://example.com/", Title: "Example",
		Elements: []hostdomain.BrowserElement{{Ref: "e1", Role: "link", Name: "More information"}},
		JPEG:     []byte{0xff, 0xd8, 0xff},
	}}
	b := newBrowserHarness(t, browsers)
	b.on(t)
	b.act(t, map[string]any{"action": "click", "ref": "e1", "picture": true})
	page := b.waitPages(t, browserCommandID, 1)[0]
	if page.Title != "Example" || len(page.Elements) != 1 || page.Elements[0].Ref != "e1" || page.Image != "/9j/" {
		t.Fatalf("page = %+v", page)
	}
	acted := browsers.Acted()
	if len(acted) != 1 || acted[0].Browser != "juno" || acted[0].Ref != "e1" || !acted[0].Picture || acted[0].Pointed {
		t.Fatalf("acted = %+v", acted)
	}

	b.act(t, map[string]any{"action": "click", "ref": "e1", "picture": true})
	b.waitPages(t, browserCommandID, 2)
	if again := browsers.Acted(); len(again) != 1 {
		t.Fatalf("acted %d times, want once", len(again))
	}
}

// What a bot may open is checked on the host too, and each way a browser
// can fail says which it was, so the bot tells the person the right thing.
func TestABrowserRefusalSaysWhy(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		fields map[string]any
		want   string
	}{
		{"a file on the host", nil, map[string]any{"action": "open", "url": "file:///etc/passwd"}, hostdomain.ErrBrowserAction.Code},
		{"no browser installed", fmt.Errorf("%w: no Chrome", hostdomain.ErrNoBrowser), map[string]any{"action": "open", "url": "https://example.com"}, hostdomain.ErrBrowserMissing.Code},
		{"a stale ref", fmt.Errorf("%w: e9", hostdomain.ErrBrowserRef), map[string]any{"action": "click", "ref": "e9"}, hostdomain.ErrBrowserAction.Code},
		{"the page crashed", fmt.Errorf("the browser's connection ended"), map[string]any{"action": "read"}, hostdomain.ErrBrowserFailed.Code},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			b := newBrowserHarness(t, &hostfake.Browsers{Err: c.err})
			b.on(t)
			b.act(t, c.fields)
			failed := b.sent.waitFor(t, "command.failed", isCommandFailed(browserCommandID)).(link.CommandFailed)
			if failed.Code != c.want {
				t.Fatalf("code = %s, want %s", failed.Code, c.want)
			}
		})
	}
}

// A page whose text and names are all characters JSON writes as six bytes
// came out over the link's frame, and the answer was dropped: it is trimmed
// to fit, text first, and says it was cut.
func TestAPageTooLargeForAFrameIsTrimmedNotDropped(t *testing.T) {
	page := link.BrowserPage{
		Type: link.TypeBrowserPage, CommandID: "c1", URL: "https://example.com/", Title: "Big",
		Text:  strings.Repeat("<", browserTextMax),
		Image: strings.Repeat("A", link.ComputerScreenshotMaxBytes/3*4),
	}
	for index := 0; index < browserElementsMax; index++ {
		page.Elements = append(page.Elements, link.BrowserPageElements{
			Ref: "e" + strconv.Itoa(index+1), Role: "link", Name: strings.Repeat("<", 200), Value: strings.Repeat("&", 200),
		})
	}
	if !fitBrowserPage(&page, link.MaxFrameBytes) {
		t.Fatal("the page was given up on, want it trimmed")
	}
	body, err := json.Marshal(page)
	if err != nil {
		t.Fatal(err)
	}
	if len(body) > link.MaxFrameBytes {
		t.Fatalf("the frame is %d bytes, over the link's %d", len(body), link.MaxFrameBytes)
	}
	if !page.TextTruncated || page.Image == "" || len(page.Elements) == 0 {
		t.Fatalf("truncated=%v, picture kept=%v, %d elements: want the text cut and the rest kept",
			page.TextTruncated, page.Image != "", len(page.Elements))
	}
}

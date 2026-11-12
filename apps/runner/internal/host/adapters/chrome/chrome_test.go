package chrome

import (
	"bytes"
	"context"
	"errors"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

const site = `<!doctype html><title>Shop</title>
<h1>Welcome to the shop</h1>
<a href="/pricing" target="_blank">Pricing</a>
<label for="q">Search</label><input id="q" value="old words">
<input type="password" id="pw" aria-label="Password" value="hunter2">
<button id="go" onclick="document.getElementById('out').innerText = 'You searched: ' + document.getElementById('q').value">Search now</button>
<p id="out"></p>
<button style="display:none">Hidden</button>`

const pricing = `<!doctype html><title>Pricing</title><h1>Plans</h1><p>Team plan: 12 euros.</p><a href="/">Home</a>`

func request(action domain.BrowserAction) domain.BrowserRequest {
	return domain.BrowserRequest{
		Browser: "juno", Action: action,
		MaxElements: 150, MaxTextBytes: 24 << 10, PictureMaxBytes: 256 << 10,
	}
}

func refOf(t *testing.T, page domain.BrowserPage, role, name string) string {
	t.Helper()
	for _, element := range page.Elements {
		if element.Role == role && element.Name == name {
			return element.Ref
		}
	}
	t.Fatalf("no %s named %q among %+v", role, name, page.Elements)
	return ""
}

// A real browser, driven the way a bot drives it: the page comes back as
// things to act on, a ref clicks and types where it points, a link meant for
// a new tab opens in this one, and a password is never read out. Skipped
// where no browser is installed.
func TestABotReadsAPageAndActsOnItsRefs(t *testing.T) {
	browsers := New(Options{Dir: t.TempDir()})
	if _, err := browsers.Available(); err != nil {
		t.Skipf("no browser: %v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(site)) })
	mux.HandleFunc("/pricing", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(pricing)) })
	server := httptest.NewServer(mux)
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	t.Cleanup(func() { _, _ = browsers.Act(context.Background(), request(domain.BrowserClose)) })

	// Nothing to read before a page is open.
	if _, err := browsers.Act(ctx, request(domain.BrowserRead)); !errors.Is(err, domain.ErrBrowserNotOpen) {
		t.Fatalf("read before open = %v, want ErrBrowserNotOpen", err)
	}

	open := request(domain.BrowserOpen)
	open.URL = server.URL
	page, err := browsers.Act(ctx, open)
	if err != nil {
		t.Fatal(err)
	}
	if page.Title != "Shop" || !strings.HasPrefix(page.URL, server.URL) {
		t.Fatalf("opened %q at %s", page.Title, page.URL)
	}
	for _, element := range page.Elements {
		if element.Name == "Hidden" {
			t.Fatal("an element nobody can see was listed")
		}
		if strings.Contains(element.Value, "hunter2") {
			t.Fatal("a password's value was read off the page")
		}
	}
	search := refOf(t, page, "textbox", "Search")

	// Typing into a ref replaces what the field held.
	typing := request(domain.BrowserType)
	typing.Ref, typing.Text = search, "red shoes"
	if _, err := browsers.Act(ctx, typing); err != nil {
		t.Fatal(err)
	}
	click := request(domain.BrowserClick)
	click.Ref = refOf(t, page, "button", "Search now")
	if _, err := browsers.Act(ctx, click); err != nil {
		t.Fatal(err)
	}
	read, err := browsers.Act(ctx, request(domain.BrowserRead))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(read.Text, "You searched: red shoes") {
		t.Fatalf("the page says %q, want the search for red shoes", read.Text)
	}

	// A link that would open a new tab opens here, where the bot can see it.
	click.Ref = refOf(t, read, "link", "Pricing")
	priced, err := browsers.Act(ctx, click)
	if err != nil {
		t.Fatal(err)
	}
	if priced.Title != "Pricing" {
		t.Fatalf("after the link the page is %q, want Pricing", priced.Title)
	}

	// A ref from the page before is refused, not clicked somewhere else.
	stale := request(domain.BrowserClick)
	stale.Ref = "e99"
	if _, err := browsers.Act(ctx, stale); !errors.Is(err, domain.ErrBrowserRef) {
		t.Fatalf("a stale ref = %v, want ErrBrowserRef", err)
	}

	back, err := browsers.Act(ctx, request(domain.BrowserBack))
	if err != nil {
		t.Fatal(err)
	}
	if back.Title != "Shop" {
		t.Fatalf("after back the page is %q, want Shop", back.Title)
	}

	shot, err := browsers.Act(ctx, request(domain.BrowserScreenshot))
	if err != nil {
		t.Fatal(err)
	}
	picture, err := jpeg.Decode(bytes.NewReader(shot.JPEG))
	if err != nil {
		t.Fatal(err)
	}
	if size := picture.Bounds().Size(); size.X != viewportWidth || size.Y != viewportHeight {
		t.Fatalf("the picture is %v, want %d by %d", size, viewportWidth, viewportHeight)
	}

	closed, err := browsers.Act(ctx, request(domain.BrowserClose))
	if err != nil || !closed.Closed {
		t.Fatalf("close = %+v, %v", closed, err)
	}
}

// One key name on the wire is a key, a code and a number to the browser; a
// wrong row presses another key, and a modifier must not type its letter.
func TestAKeyPressIsNamedForTheBrowser(t *testing.T) {
	cases := []struct {
		key  string
		want keyEvent
	}{
		{"enter", keyEvent{Key: "Enter", Code: "Enter", VirtualKC: 13, Text: "\r"}},
		{"a", keyEvent{Key: "a", Code: "KeyA", VirtualKC: 65, Text: "a"}},
		{"shift+a", keyEvent{Key: "A", Code: "KeyA", VirtualKC: 65, Text: "A", Modifiers: 8}},
		{"ctrl+a", keyEvent{Key: "a", Code: "KeyA", VirtualKC: 65, Modifiers: 2}},
		{"cmd+shift+4", keyEvent{Key: "4", Code: "Digit4", VirtualKC: 52, Modifiers: 12}},
		{"f5", keyEvent{Key: "F5", Code: "F5", VirtualKC: 116}},
		{"pagedown", keyEvent{Key: "PageDown", Code: "PageDown", VirtualKC: 34}},
	}
	for _, c := range cases {
		press, err := domain.ParseKeyPress(c.key)
		if err != nil {
			t.Fatal(err)
		}
		if got := keyEventOf(press); got != c.want {
			t.Errorf("%s = %+v, want %+v", c.key, got, c.want)
		}
	}
}

func TestCutTextKeepsWholeCharacters(t *testing.T) {
	// The fifth byte is the middle of the last ñ.
	text, cut := cutText("añoñ", 5)
	if text != "año" || !cut {
		t.Fatalf("cutText = %q, %v, want %q cut", text, cut, "año")
	}
}

// hostile is a page that works against its reader: it swaps the function
// the reader's script ends on, and offers a file to save.
const hostile = `<!doctype html><title>Honest title</title>
<script>JSON.stringify = function () {
  return '{"title":"Forged","elements":[{"ref":"zz0","role":"link","name":"forged"}],"text":"forged"}';
};</script>
<a href="/payload">Get the file</a>`

// What a page can do to the host and to its own reading. A page's script
// that replaced JSON.stringify answered for the whole page, forged address
// and elements included; a link to an attachment saved a file in the
// account's Downloads; and a pid file left by a runner that died had the
// next open kill whatever process held that number by then.
func TestAPageCannotForgeItsReadingOrSaveAFileAndAStalePidKillsNothing(t *testing.T) {
	dir := t.TempDir()
	browsers := New(Options{Dir: dir})
	if _, err := browsers.Available(); err != nil {
		t.Skipf("no browser: %v", err)
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DOWNLOAD_DIR", filepath.Join(home, "Downloads"))
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(hostile)) })
	mux.HandleFunc("/payload", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Disposition", `attachment; filename="payload.sh"`)
		_, _ = w.Write([]byte("echo hello"))
	})
	server := httptest.NewServer(mux)
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	t.Cleanup(func() { _, _ = browsers.Act(context.Background(), request(domain.BrowserClose)) })

	// A bystander with a process group of its own, named by a pid file the
	// way a browser of a runner that died would be.
	bystander := exec.Command("sleep", "300")
	tieToRunner(bystander)
	if err := bystander.Start(); err != nil {
		t.Fatal(err)
	}
	gone := make(chan error, 1)
	go func() { gone <- bystander.Wait() }()
	t.Cleanup(func() { _ = bystander.Process.Kill() })
	profile := filepath.Join(dir, "juno")
	if err := os.MkdirAll(profile, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(profile, "runner.pid"), []byte(strconv.Itoa(bystander.Process.Pid)), 0o600); err != nil {
		t.Fatal(err)
	}

	open := request(domain.BrowserOpen)
	open.URL = server.URL
	page, err := browsers.Act(ctx, open)
	if err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-gone:
		t.Fatalf("the open ended a process that was no browser of this profile: %v", err)
	default:
	}
	if page.Title != "Honest title" || !strings.HasPrefix(page.URL, server.URL) {
		t.Fatalf("read %q at %s, want the page's real title and address", page.Title, page.URL)
	}

	click := request(domain.BrowserClick)
	click.Ref = refOf(t, page, "link", "Get the file")
	if _, err := browsers.Act(ctx, click); err != nil {
		t.Fatal(err)
	}
	_ = sleep(ctx, time.Second)
	saved, _ := filepath.Glob(filepath.Join(home, "*", "payload*"))
	if len(saved) > 0 {
		t.Fatalf("the page saved %v on the host", saved)
	}
}

// What is read off a page is held to the answer's limits, counted the way
// the link's schema counts: a character outside the basic plane is two.
func TestCutUnitsCountsTheWayTheLinkDoes(t *testing.T) {
	if got := cutUnits("ab😀cd", 3); got != "ab" {
		t.Fatalf("cutUnits = %q, want %q", got, "ab")
	}
	if got := cutUnits("ab😀cd", 4); got != "ab😀" {
		t.Fatalf("cutUnits = %q, want %q", got, "ab😀")
	}
}

func TestOnlyABrowserOnTheProfileIsALeftover(t *testing.T) {
	command := "/usr/bin/chromium --headless=new --user-data-dir=/home/a/browsers/juno about:blank"
	if !runsOnProfile(command, "/home/a/browsers/juno") {
		t.Fatal("the browser on the profile was not recognised")
	}
	if runsOnProfile(command, "/home/a/browsers/jun") || runsOnProfile("sleep 300", "/home/a/browsers/juno") {
		t.Fatal("a process that is no browser of this profile was taken for one")
	}
}

// A sign-in outlives the browser: close was a kill, and a cookie set moments
// before it was never written to the profile. CloseAll ends what is open.
func TestACookieSurvivesACloseRightAfterItWasSet(t *testing.T) {
	browsers := New(Options{Dir: t.TempDir()})
	if _, err := browsers.Available(); err != nil {
		t.Skipf("no browser: %v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/in", func(w http.ResponseWriter, _ *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "who", Value: "juno", Path: "/", MaxAge: 3600})
		_, _ = w.Write([]byte("<title>In</title>"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		who := "nobody"
		if cookie, err := r.Cookie("who"); err == nil {
			who = cookie.Value
		}
		_, _ = w.Write([]byte("<title>Hello " + who + "</title>"))
	})
	server := httptest.NewServer(mux)
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	t.Cleanup(browsers.CloseAll)

	open := request(domain.BrowserOpen)
	open.URL = server.URL + "/in"
	if _, err := browsers.Act(ctx, open); err != nil {
		t.Fatal(err)
	}
	if _, err := browsers.Act(ctx, request(domain.BrowserClose)); err != nil {
		t.Fatal(err)
	}
	open.URL = server.URL
	page, err := browsers.Act(ctx, open)
	if err != nil {
		t.Fatal(err)
	}
	if page.Title != "Hello juno" {
		t.Fatalf("after closing and opening again the site says %q, want the sign-in kept", page.Title)
	}

	browsers.CloseAll()
	if _, err := browsers.Act(ctx, request(domain.BrowserRead)); !errors.Is(err, domain.ErrBrowserNotOpen) {
		t.Fatalf("read after CloseAll = %v, want ErrBrowserNotOpen", err)
	}
}

// A browser nobody acted in for idleFor is closed when another bot acts,
// and the one in use is kept.
func TestABrowserLeftIdleIsClosedWhenAnotherBotActs(t *testing.T) {
	browsers := New(Options{Dir: t.TempDir()})
	if _, err := browsers.Available(); err != nil {
		t.Skipf("no browser: %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("<title>Here</title>"))
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	t.Cleanup(browsers.CloseAll)

	open := request(domain.BrowserOpen)
	open.URL = server.URL
	if _, err := browsers.Act(ctx, open); err != nil {
		t.Fatal(err)
	}
	browsers.mu.Lock()
	idle := browsers.instances["juno"]
	browsers.mu.Unlock()
	idle.mu.Lock()
	idle.used = time.Now().Add(-idleFor - time.Minute)
	process := idle.cmd.Process
	idle.mu.Unlock()

	other := open
	other.Browser = "milo"
	if _, err := browsers.Act(ctx, other); err != nil {
		t.Fatal(err)
	}
	if err := process.Signal(syscall.Signal(0)); err == nil {
		t.Fatal("the idle browser is still running")
	}
	if _, err := browsers.Act(ctx, request(domain.BrowserRead)); !errors.Is(err, domain.ErrBrowserNotOpen) {
		t.Fatalf("read in the idle browser = %v, want ErrBrowserNotOpen", err)
	}
	read := request(domain.BrowserRead)
	read.Browser = "milo"
	if page, err := browsers.Act(ctx, read); err != nil || page.Title != "Here" {
		t.Fatalf("the browser in use answered %q, %v", page.Title, err)
	}
}

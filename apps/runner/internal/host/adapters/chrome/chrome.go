// Package chrome is app.Browsers: a Chrome or Chromium per bot, started
// headless on the bot's first open with a profile of its own under the
// runner home, and driven over the DevTools protocol. The bot reads the page
// as a list of elements with refs and acts on a ref; a picture of the page
// is its second sense.
package chrome

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Browsers = (*Browsers)(nil)

const (
	viewportWidth  = 1280
	viewportHeight = 800
	// startTimeout bounds a browser's start, loadTimeout a page's load, and
	// callTimeout one question to the browser.
	startTimeout = 20 * time.Second
	loadTimeout  = 15 * time.Second
	callTimeout  = 20 * time.Second
	// settle is how long the page is left after an action before it is read:
	// a click answered with the page as it was says nothing happened.
	settle = 400 * time.Millisecond
	// idleFor is how long a browser nobody acts in is kept.
	idleFor = 20 * time.Minute
)

// candidates are the programs tried, in order, when Options names none.
var candidates = []string{
	"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
}

// Options are what the composition root knows.
type Options struct {
	// Dir is where the bots' profiles live, one folder each.
	Dir string
	// Program is the browser to start; empty looks for one.
	Program string
}

// Browsers is the bots' browsers on this host.
type Browsers struct {
	opts Options

	mu        sync.Mutex
	instances map[string]*instance
}

// New builds the adapter. Nothing is started until a bot opens a page.
func New(opts Options) *Browsers {
	return &Browsers{opts: opts, instances: map[string]*instance{}}
}

// Available is the program that would be started.
func (b *Browsers) Available() (string, error) {
	if b.opts.Program != "" {
		return b.opts.Program, nil
	}
	for _, candidate := range candidates {
		if strings.Contains(candidate, "/") {
			if _, err := os.Stat(candidate); err == nil {
				return candidate, nil
			}
			continue
		}
		if path, err := exec.LookPath(candidate); err == nil {
			return path, nil
		}
	}
	hint := "sudo apt install chromium"
	if runtime.GOOS == "darwin" {
		hint = "install Google Chrome"
	}
	return "", fmt.Errorf("%w: neither Chrome, Chromium nor Edge is installed (%s)", domain.ErrNoBrowser, hint)
}

// Act does one action in the browser req names and answers with the page.
func (b *Browsers) Act(ctx context.Context, req domain.BrowserRequest) (domain.BrowserPage, error) {
	b.mu.Lock()
	b.reapLocked(req.Browser)
	inst := b.instances[req.Browser]
	if inst == nil {
		if req.Action == domain.BrowserClose {
			b.mu.Unlock()
			return domain.BrowserPage{Closed: true}, nil
		}
		if req.Action != domain.BrowserOpen {
			b.mu.Unlock()
			return domain.BrowserPage{}, fmt.Errorf("%w: open an address first", domain.ErrBrowserNotOpen)
		}
		inst = &instance{dir: filepath.Join(b.opts.Dir, req.Browser)}
		b.instances[req.Browser] = inst
	}
	b.mu.Unlock()

	inst.mu.Lock()
	defer inst.mu.Unlock()
	inst.used = time.Now()

	if req.Action == domain.BrowserClose {
		inst.stop()
		b.forget(req.Browser, inst)
		return domain.BrowserPage{Closed: true}, nil
	}
	if inst.conn == nil {
		program, err := b.Available()
		if err != nil {
			b.forget(req.Browser, inst)
			return domain.BrowserPage{}, err
		}
		if err := inst.start(ctx, program); err != nil {
			inst.stop()
			b.forget(req.Browser, inst)
			return domain.BrowserPage{}, err
		}
	}
	page, err := inst.act(ctx, req)
	if err != nil && inst.conn != nil && inst.conn.closedErr() != nil {
		// The browser itself is gone: the next open starts a fresh one.
		inst.stop()
		b.forget(req.Browser, inst)
	}
	return page, err
}

func (b *Browsers) forget(id string, inst *instance) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.instances[id] == inst {
		delete(b.instances, id)
	}
}

// reapLocked ends the browsers nobody acted in for idleFor, but not keep's.
func (b *Browsers) reapLocked(keep string) {
	for id, inst := range b.instances {
		if id == keep || !inst.mu.TryLock() {
			continue
		}
		if time.Since(inst.used) > idleFor {
			inst.stop()
			delete(b.instances, id)
		}
		inst.mu.Unlock()
	}
}

// instance is one bot's browser.
type instance struct {
	dir string

	mu      sync.Mutex
	used    time.Time
	cmd     *exec.Cmd
	conn    *cdp
	session string
}

func (c *cdp) closedErr() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

// start launches the browser on the profile and attaches to its page.
func (i *instance) start(ctx context.Context, program string) error {
	if err := os.MkdirAll(i.dir, 0o700); err != nil {
		return err
	}
	i.endLeftover()
	portFile := filepath.Join(i.dir, "DevToolsActivePort")
	_ = os.Remove(portFile)
	args := []string{
		"--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + i.dir,
		"--no-first-run", "--no-default-browser-check", "--disable-gpu",
		"--password-store=basic", "--use-mock-keychain",
		"--window-size=" + strconv.Itoa(viewportWidth) + "," + strconv.Itoa(viewportHeight),
		"about:blank",
	}
	if os.Geteuid() == 0 {
		// Chrome refuses its sandbox as root. The runner itself refuses to
		// run as root (HOST_002); this is for containers and tests.
		args = append([]string{"--no-sandbox"}, args...)
	}
	// Not bound to ctx: the browser outlives the action that first needed it.
	cmd := exec.Command(program, args...) //nolint:gosec,noctx // a browser found on this host, fixed arguments
	tieToRunner(cmd)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("%w: start %s: %w", domain.ErrNoBrowser, program, err)
	}
	i.cmd = cmd
	_ = os.WriteFile(filepath.Join(i.dir, "runner.pid"), []byte(strconv.Itoa(cmd.Process.Pid)), 0o600)

	startCtx, cancel := context.WithTimeout(ctx, startTimeout)
	defer cancel()
	endpoint, err := waitForEndpoint(startCtx, portFile)
	if err != nil {
		return err
	}
	conn, err := dialCDP(startCtx, endpoint, i.onEvent)
	if err != nil {
		return fmt.Errorf("connect to the browser: %w", err)
	}
	i.conn = conn

	var targets struct {
		TargetInfos []struct {
			TargetID string `json:"targetId"`
			Type     string `json:"type"`
		} `json:"targetInfos"`
	}
	if err := conn.call(startCtx, "", "Target.getTargets", nil, &targets); err != nil {
		return err
	}
	target := ""
	for _, info := range targets.TargetInfos {
		if info.Type == "page" {
			target = info.TargetID
			break
		}
	}
	if target == "" {
		return errors.New("the browser opened no page")
	}
	var attached struct {
		SessionID string `json:"sessionId"`
	}
	if err := conn.call(startCtx, "", "Target.attachToTarget",
		map[string]any{"targetId": target, "flatten": true}, &attached); err != nil {
		return err
	}
	i.session = attached.SessionID
	if err := i.call(startCtx, "Page.enable", nil, nil); err != nil {
		return err
	}
	return i.call(startCtx, "Emulation.setDeviceMetricsOverride", map[string]any{
		"width": viewportWidth, "height": viewportHeight, "deviceScaleFactor": 1, "mobile": false,
	}, nil)
}

// endLeftover ends a browser an earlier runner left on this profile: where
// the kernel does not end a child with its parent, it would hold the profile.
func (i *instance) endLeftover() {
	raw, err := os.ReadFile(filepath.Join(i.dir, "runner.pid"))
	if err != nil {
		return
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil || pid <= 1 {
		return
	}
	// The group, which is the browser and its helpers; nothing else was
	// ever started with this profile's pid file.
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	_ = os.Remove(filepath.Join(i.dir, "runner.pid"))
}

func waitForEndpoint(ctx context.Context, portFile string) (string, error) {
	for {
		if raw, err := os.ReadFile(portFile); err == nil { //nolint:gosec // the profile this runner made
			lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
			if len(lines) >= 2 {
				return "ws://127.0.0.1:" + strings.TrimSpace(lines[0]) + strings.TrimSpace(lines[1]), nil
			}
		}
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("the browser did not start within %s", startTimeout)
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// onEvent answers a page's dialog at once: an alert left open stops every
// later question to the page.
func (i *instance) onEvent(session, method string, _ json.RawMessage) {
	if method != "Page.javascriptDialogOpening" {
		return
	}
	conn := i.conn
	if conn == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
		defer cancel()
		_ = conn.call(ctx, session, "Page.handleJavaScriptDialog", map[string]any{"accept": true}, nil)
	}()
}

func (i *instance) stop() {
	if i.conn != nil {
		i.conn.close()
		i.conn = nil
	}
	if i.cmd != nil && i.cmd.Process != nil {
		_ = syscall.Kill(-i.cmd.Process.Pid, syscall.SIGKILL)
		_ = i.cmd.Wait()
		i.cmd = nil
	}
	_ = os.Remove(filepath.Join(i.dir, "runner.pid"))
}

func (i *instance) call(ctx context.Context, method string, params, out any) error {
	callCtx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	return i.conn.call(callCtx, i.session, method, params, out)
}

// eval runs an expression in the page and answers its string value.
func (i *instance) eval(ctx context.Context, expression string) (string, error) {
	var out struct {
		Result struct {
			Value any `json:"value"`
		} `json:"result"`
		ExceptionDetails *struct {
			Text string `json:"text"`
		} `json:"exceptionDetails"`
	}
	if err := i.call(ctx, "Runtime.evaluate",
		map[string]any{"expression": expression, "returnByValue": true}, &out); err != nil {
		return "", err
	}
	if out.ExceptionDetails != nil {
		return "", fmt.Errorf("the page refused: %s", out.ExceptionDetails.Text)
	}
	switch value := out.Result.Value.(type) {
	case string:
		return value, nil
	case bool:
		return strconv.FormatBool(value), nil
	}
	return "", nil
}

// act does the action, lets the page settle, and reads it.
func (i *instance) act(ctx context.Context, req domain.BrowserRequest) (domain.BrowserPage, error) {
	changes := true
	switch req.Action {
	case domain.BrowserOpen:
		var navigated struct {
			ErrorText string `json:"errorText"`
		}
		if err := i.call(ctx, "Page.navigate", map[string]any{"url": req.URL}, &navigated); err != nil {
			return domain.BrowserPage{}, err
		}
		if navigated.ErrorText != "" {
			return domain.BrowserPage{}, fmt.Errorf("%s did not open: %s", req.URL, navigated.ErrorText)
		}
	case domain.BrowserRead, domain.BrowserScreenshot:
		changes = false
	case domain.BrowserWait:
		if err := sleep(ctx, req.Wait); err != nil {
			return domain.BrowserPage{}, err
		}
		changes = false
	case domain.BrowserBack:
		if _, err := i.eval(ctx, "history.back()"); err != nil {
			return domain.BrowserPage{}, err
		}
	case domain.BrowserClick:
		x, y := req.X, req.Y
		if req.Ref != "" {
			var err error
			if x, y, err = i.pointOf(ctx, req.Ref); err != nil {
				return domain.BrowserPage{}, err
			}
		}
		if err := i.click(ctx, x, y); err != nil {
			return domain.BrowserPage{}, err
		}
	case domain.BrowserType:
		if req.Ref != "" {
			x, y, err := i.pointOf(ctx, req.Ref)
			if err != nil {
				return domain.BrowserPage{}, err
			}
			if err := i.click(ctx, x, y); err != nil {
				return domain.BrowserPage{}, err
			}
			if _, err := i.eval(ctx, clearScript+"("+strconv.Quote(req.Ref)+")"); err != nil {
				return domain.BrowserPage{}, err
			}
		}
		if err := i.call(ctx, "Input.insertText", map[string]any{"text": req.Text}, nil); err != nil {
			return domain.BrowserPage{}, err
		}
	case domain.BrowserKey:
		for _, key := range req.Keys {
			press, err := domain.ParseKeyPress(key)
			if err != nil {
				return domain.BrowserPage{}, err
			}
			if err := i.press(ctx, keyEventOf(press)); err != nil {
				return domain.BrowserPage{}, err
			}
		}
	case domain.BrowserScroll:
		if err := i.call(ctx, "Input.dispatchMouseEvent", map[string]any{
			"type": "mouseWheel", "x": viewportWidth / 2, "y": viewportHeight / 2,
			"deltaX": 0, "deltaY": req.ScrollY * 100,
		}, nil); err != nil {
			return domain.BrowserPage{}, err
		}
	default:
		return domain.BrowserPage{}, fmt.Errorf("%w %q", domain.ErrBrowserActionUnknown, req.Action)
	}
	if changes {
		if err := sleep(ctx, settle); err != nil {
			return domain.BrowserPage{}, err
		}
		i.waitLoaded(ctx)
	}
	return i.read(ctx, req)
}

func (i *instance) pointOf(ctx context.Context, ref string) (int, int, error) {
	point, err := i.eval(ctx, pointScript+"("+strconv.Quote(ref)+")")
	if err != nil {
		return 0, 0, err
	}
	var x, y int
	if _, err := fmt.Sscanf(point, "%d,%d", &x, &y); err != nil {
		return 0, 0, fmt.Errorf("%w: %s (read the page again for its refs)", domain.ErrBrowserRef, ref)
	}
	return x, y, nil
}

func (i *instance) click(ctx context.Context, x, y int) error {
	for _, kind := range []string{"mouseMoved", "mousePressed", "mouseReleased"} {
		params := map[string]any{"type": kind, "x": x, "y": y}
		if kind != "mouseMoved" {
			params["button"], params["clickCount"] = "left", 1
		}
		if err := i.call(ctx, "Input.dispatchMouseEvent", params, nil); err != nil {
			return err
		}
	}
	return nil
}

func (i *instance) press(ctx context.Context, event keyEvent) error {
	down := map[string]any{
		"type": "rawKeyDown", "key": event.Key, "code": event.Code,
		"windowsVirtualKeyCode": event.VirtualKC, "modifiers": event.Modifiers,
	}
	if event.Text != "" {
		down["type"], down["text"] = "keyDown", event.Text
	}
	if err := i.call(ctx, "Input.dispatchKeyEvent", down, nil); err != nil {
		return err
	}
	return i.call(ctx, "Input.dispatchKeyEvent", map[string]any{
		"type": "keyUp", "key": event.Key, "code": event.Code,
		"windowsVirtualKeyCode": event.VirtualKC, "modifiers": event.Modifiers,
	}, nil)
}

// waitLoaded waits for the page to finish loading, as far as loadTimeout: a
// page that never finishes is read as it is.
func (i *instance) waitLoaded(ctx context.Context) {
	deadline := time.Now().Add(loadTimeout)
	for time.Now().Before(deadline) {
		state, err := i.eval(ctx, "document.readyState")
		if err == nil && state == "complete" {
			return
		}
		if sleep(ctx, 150*time.Millisecond) != nil {
			return
		}
	}
}

// read is the page as it is now.
func (i *instance) read(ctx context.Context, req domain.BrowserRequest) (domain.BrowserPage, error) {
	wantText := req.Action == domain.BrowserRead
	raw, err := i.eval(ctx, listScript+"("+strconv.Itoa(req.MaxElements)+","+strconv.FormatBool(wantText)+")")
	if err != nil {
		return domain.BrowserPage{}, err
	}
	var listed struct {
		URL      string `json:"url"`
		Title    string `json:"title"`
		Elements []struct {
			Ref   string `json:"ref"`
			Role  string `json:"role"`
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"elements"`
		More bool   `json:"more"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal([]byte(raw), &listed); err != nil {
		return domain.BrowserPage{}, errors.New("the page could not be read")
	}
	page := domain.BrowserPage{URL: listed.URL, Title: listed.Title, MoreElements: listed.More}
	for _, element := range listed.Elements {
		page.Elements = append(page.Elements, domain.BrowserElement{
			Ref: element.Ref, Role: element.Role, Name: element.Name, Value: element.Value,
		})
	}
	page.Text, page.TextTruncated = cutText(listed.Text, req.MaxTextBytes)
	if req.Picture || req.Action == domain.BrowserScreenshot {
		if page.JPEG, err = i.picture(ctx, req.PictureMaxBytes); err != nil {
			return domain.BrowserPage{}, err
		}
	}
	return page, nil
}

// picture is the page as a JPEG of at most maxBytes: the best quality that fits.
func (i *instance) picture(ctx context.Context, maxBytes int) ([]byte, error) {
	for _, quality := range []int{70, 45, 25} {
		var shot struct {
			Data string `json:"data"`
		}
		if err := i.call(ctx, "Page.captureScreenshot",
			map[string]any{"format": "jpeg", "quality": quality}, &shot); err != nil {
			return nil, err
		}
		raw, err := base64.StdEncoding.DecodeString(shot.Data)
		if err != nil {
			return nil, errors.New("the browser's picture is not one")
		}
		if maxBytes <= 0 || len(raw) <= maxBytes {
			return raw, nil
		}
	}
	return nil, errors.New("the page's picture does not fit the largest image a bot is sent")
}

// cutText keeps the first maxBytes of text, on a whole character.
func cutText(text string, maxBytes int) (string, bool) {
	if maxBytes <= 0 || len(text) <= maxBytes {
		return text, false
	}
	cut := maxBytes
	for cut > 0 && !utf8.RuneStart(text[cut]) {
		cut--
	}
	return text[:cut], true
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

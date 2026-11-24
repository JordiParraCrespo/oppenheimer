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
	"regexp"
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
	// closeTimeout is how long a browser asked to close is waited for.
	closeTimeout = 5 * time.Second
	// settle is how long the page is left after an action before it is read:
	// a click answered with the page as it was says nothing happened.
	settle = 400 * time.Millisecond
	// The most of each part of a page that is answered, as the link's
	// browser.page states them.
	urlMax   = 2048
	titleMax = 300
	roleMax  = 32
	nameMax  = 200
	// idleFor is how long a browser nobody acts in is kept.
	idleFor = 20 * time.Minute
)

var refPattern = regexp.MustCompile(`^e[1-9][0-9]{0,3}$`)

const profileFlag = "--user-data-dir="

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
		// used is set here, before the lock is let go: another bot's action
		// must not reap a browser that has not started yet.
		inst = &instance{dir: filepath.Join(b.opts.Dir, req.Browser), used: time.Now()}
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

// CloseAll ends every bot's browser, for a host whose owner turned browser
// use off while some were open.
func (b *Browsers) CloseAll() {
	b.mu.Lock()
	open := b.instances
	b.instances = map[string]*instance{}
	b.mu.Unlock()
	for _, inst := range open {
		inst.mu.Lock()
		inst.stop()
		inst.mu.Unlock()
	}
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
	// The browser reads commands on its descriptor 3 and answers on 4.
	commandsOut, commandsIn, err := os.Pipe()
	if err != nil {
		return err
	}
	answersOut, answersIn, err := os.Pipe()
	if err != nil {
		_ = commandsOut.Close()
		_ = commandsIn.Close()
		return err
	}
	args := []string{
		"--headless=new", "--remote-debugging-pipe", profileFlag + i.dir,
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
	cmd.ExtraFiles = []*os.File{commandsOut, answersIn}
	err = cmd.Start()
	_ = commandsOut.Close()
	_ = answersIn.Close()
	if err != nil {
		_ = commandsIn.Close()
		_ = answersOut.Close()
		return fmt.Errorf("%w: start %s: %w", domain.ErrNoBrowser, program, err)
	}
	i.cmd = cmd
	i.conn = newCDP(commandsIn, answersOut, i.onEvent)
	conn := i.conn
	_ = os.WriteFile(filepath.Join(i.dir, "runner.pid"), []byte(strconv.Itoa(cmd.Process.Pid)), 0o600)

	startCtx, cancel := context.WithTimeout(ctx, startTimeout)
	defer cancel()
	// A page saves nothing on the host: a download is refused.
	if err := conn.call(startCtx, "", "Browser.setDownloadBehavior", map[string]any{"behavior": "deny"}, nil); err != nil {
		return fmt.Errorf("the browser did not start: %w", err)
	}
	target, err := firstPage(startCtx, conn)
	if err != nil {
		return err
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

// firstPage is the page the browser opened with, which may be a moment
// after it first answers.
func firstPage(ctx context.Context, conn *cdp) (string, error) {
	for {
		var targets struct {
			TargetInfos []struct {
				TargetID string `json:"targetId"`
				Type     string `json:"type"`
			} `json:"targetInfos"`
		}
		if err := conn.call(ctx, "", "Target.getTargets", nil, &targets); err != nil {
			return "", err
		}
		for _, info := range targets.TargetInfos {
			if info.Type == "page" {
				return info.TargetID, nil
			}
		}
		if err := sleep(ctx, 100*time.Millisecond); err != nil {
			return "", errors.New("the browser opened no page")
		}
	}
}

// endLeftover ends a browser an earlier runner left on this profile: where
// the kernel does not end a child with its parent, it would hold the profile.
// The pid file may be older than a restart of the machine, so the process is
// ended only when it is a browser on this very profile.
func (i *instance) endLeftover() {
	pidFile := filepath.Join(i.dir, "runner.pid")
	raw, err := os.ReadFile(pidFile) //nolint:gosec // the profile this runner made
	if err != nil {
		return
	}
	_ = os.Remove(pidFile)
	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil || pid <= 1 {
		return
	}
	command, err := exec.Command("ps", "-ww", "-o", "command=", "-p", strconv.Itoa(pid)).Output() //nolint:gosec,noctx // a number
	if err != nil || !runsOnProfile(string(command), i.dir) {
		return
	}
	// The group, which is the browser and its helpers.
	_ = syscall.Kill(-pid, syscall.SIGKILL)
}

// runsOnProfile is whether a process's command line is a browser started on
// the profile dir.
func runsOnProfile(command, dir string) bool {
	for _, field := range strings.Fields(command) {
		if field == profileFlag+dir {
			return true
		}
	}
	return false
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

// stop asks the browser to close, which is when it writes its cookies to the
// profile, and ends it when it has not gone within closeTimeout.
func (i *instance) stop() {
	exited := make(chan struct{})
	if i.cmd != nil && i.cmd.Process != nil {
		cmd := i.cmd
		go func() {
			_ = cmd.Wait()
			close(exited)
		}()
	} else {
		close(exited)
	}
	if i.conn != nil {
		ctx, cancel := context.WithTimeout(context.Background(), closeTimeout)
		if i.conn.call(ctx, "", "Browser.close", nil, nil) == nil {
			select {
			case <-exited:
			case <-ctx.Done():
			}
		}
		cancel()
		i.conn.close()
		i.conn = nil
	}
	if i.cmd != nil && i.cmd.Process != nil {
		_ = syscall.Kill(-i.cmd.Process.Pid, syscall.SIGKILL)
		<-exited
		i.cmd = nil
	}
	_ = os.Remove(filepath.Join(i.dir, "runner.pid"))
}

func (i *instance) call(ctx context.Context, method string, params, out any) error {
	callCtx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	return i.conn.call(callCtx, i.session, method, params, out)
}

// eval runs an expression against the page and answers its string value.
// It runs in a world of the runner's own: it sees the page's document but
// none of the page's scripts, so a page cannot swap the functions the
// runner's scripts call and answer in their place.
func (i *instance) eval(ctx context.Context, expression string) (string, error) {
	var tree struct {
		FrameTree struct {
			Frame struct {
				ID  string `json:"id"`
				URL string `json:"url"`
			} `json:"frame"`
		} `json:"frameTree"`
	}
	if err := i.call(ctx, "Page.getFrameTree", nil, &tree); err != nil {
		return "", err
	}
	var world struct {
		ExecutionContextID int `json:"executionContextId"`
	}
	if err := i.call(ctx, "Page.createIsolatedWorld",
		map[string]any{"frameId": tree.FrameTree.Frame.ID, "worldName": "oppenheimer"}, &world); err != nil {
		return "", err
	}
	var out struct {
		Result struct {
			Value any `json:"value"`
		} `json:"result"`
		ExceptionDetails *struct {
			Text string `json:"text"`
		} `json:"exceptionDetails"`
	}
	if err := i.call(ctx, "Runtime.evaluate", map[string]any{
		"expression": expression, "returnByValue": true, "contextId": world.ExecutionContextID,
	}, &out); err != nil {
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
	address, err := i.address(ctx)
	if err != nil {
		return domain.BrowserPage{}, err
	}
	// The page's document is the page's to write, so what was read from it
	// is held to the answer's limits here, not by the script that read it.
	page := domain.BrowserPage{
		URL: cutUnits(address, urlMax), Title: cutUnits(listed.Title, titleMax), MoreElements: listed.More,
	}
	for index, element := range listed.Elements {
		if req.MaxElements > 0 && index >= req.MaxElements {
			page.MoreElements = true
			break
		}
		if !refPattern.MatchString(element.Ref) {
			continue
		}
		page.Elements = append(page.Elements, domain.BrowserElement{
			Ref: element.Ref, Role: cutUnits(element.Role, roleMax),
			Name: cutUnits(element.Name, nameMax), Value: cutUnits(element.Value, nameMax),
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

// address is where the page is, as the browser says it: the page's own
// scripts have no say in it.
func (i *instance) address(ctx context.Context) (string, error) {
	var history struct {
		CurrentIndex int `json:"currentIndex"`
		Entries      []struct {
			URL string `json:"url"`
		} `json:"entries"`
	}
	if err := i.call(ctx, "Page.getNavigationHistory", nil, &history); err != nil {
		return "", err
	}
	if history.CurrentIndex < 0 || history.CurrentIndex >= len(history.Entries) {
		return "", nil
	}
	return history.Entries[history.CurrentIndex].URL, nil
}

// cutUnits keeps the first max UTF-16 units of text, which is how the
// link's schema counts, on a whole character.
func cutUnits(text string, max int) string {
	units := 0
	for index, r := range text {
		size := 1
		if r > 0xFFFF {
			size = 2
		}
		if units+size > max {
			return text[:index]
		}
		units += size
	}
	return text
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

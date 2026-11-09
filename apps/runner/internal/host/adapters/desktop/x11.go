//go:build linux

package desktop

import (
	"context"
	"fmt"
	"image"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Desktop = (*X11)(nil)

const (
	x11Sockets = "/tmp/.X11-unix"
	// virtualFirst is the first display number tried for a virtual screen,
	// clear of the ones a login session takes.
	virtualFirst = 99
	// virtualGeometry is a virtual screen's size: the image a bot is sent,
	// so nothing is scaled.
	virtualGeometry = "1280x800x24"
	virtualStartup  = 5 * time.Second
	installHint     = "sudo apt install xdotool imagemagick xvfb"
)

// X11 drives an X display: the one the runner was started with, else one
// already on this machine that lets it in, else a virtual one it starts
// (Xvfb) and keeps for as long as it runs. A virtual screen starts empty: a
// bot opens programs on it by running them with DISPLAY set to its name.
type X11 struct {
	configured string

	mu      sync.Mutex
	display string
	virtual *exec.Cmd
}

// New is the X11 desktop.
func New(opts Options) app.Desktop { return &X11{configured: opts.Display} }

// Screen finds the display and reads its size.
func (x *X11) Screen(ctx context.Context) (domain.Screen, error) {
	display, err := x.resolve(ctx)
	if err != nil {
		return domain.Screen{}, err
	}
	width, height, err := geometry(ctx, display)
	if err != nil {
		return domain.Screen{}, err
	}
	return domain.Screen{Width: width, Height: height, Display: display}, nil
}

// Capture reads the whole display.
func (x *X11) Capture(ctx context.Context) (image.Image, error) {
	display, err := x.resolve(ctx)
	if err != nil {
		return nil, err
	}
	env := []string{"DISPLAY=" + display}
	return capturePNG(func(path string) error {
		if _, err := exec.LookPath("import"); err == nil {
			_, err := run(ctx, env, "import", "-silent", "-window", "root", path)
			return err
		}
		_, err := run(ctx, env, "scrot", "--overwrite", path)
		return err
	})
}

// Act moves the pointer and presses, through xdotool.
func (x *X11) Act(ctx context.Context, req domain.ComputerRequest) error {
	display, err := x.resolve(ctx)
	if err != nil {
		return err
	}
	at := []string{"mousemove", strconv.Itoa(req.X), strconv.Itoa(req.Y)}
	var args []string
	switch req.Action {
	case domain.ComputerMove:
		args = at
	case domain.ComputerClick:
		args = append(at, "click", "1")
	case domain.ComputerDoubleClick:
		args = append(at, "click", "--repeat", "2", "--delay", "80", "1")
	case domain.ComputerRightClick:
		args = append(at, "click", "3")
	case domain.ComputerMiddleClick:
		args = append(at, "click", "2")
	case domain.ComputerDrag:
		args = append(at, "mousedown", "1", "sleep", "0.15",
			"mousemove", strconv.Itoa(req.ToX), strconv.Itoa(req.ToY), "sleep", "0.15", "mouseup", "1")
	case domain.ComputerScroll:
		args = at
		args = append(args, wheel(req.ScrollY, "5", "4")...)
		args = append(args, wheel(req.ScrollX, "7", "6")...)
	case domain.ComputerType:
		args = []string{"type", "--clearmodifiers", "--delay", "12", "--", req.Text}
	case domain.ComputerKey:
		args = []string{"key", "--clearmodifiers", "--delay", "40"}
		for _, key := range req.Keys {
			press, err := domain.ParseKeyPress(key)
			if err != nil {
				return err
			}
			args = append(args, xKeysym(press))
		}
	default:
		return fmt.Errorf("%w %q", domain.ErrComputerActionUnknown, req.Action)
	}
	_, err = run(ctx, xdotoolEnv(display), "xdotool", args...)
	return err
}

// xdotoolEnv is the environment xdotool runs with on display. The locale is
// set because a service often has none, and xdotool reads the text it types
// in its own locale: under plain C an accented letter is an error.
func xdotoolEnv(display string) []string {
	return []string{"DISPLAY=" + display, "LC_ALL=C.UTF-8"}
}

// wheel is the clicks that turn the wheel notches times: forward's button
// when positive, back's when negative.
func wheel(notches int, forward, back string) []string {
	if notches == 0 {
		return nil
	}
	button := forward
	if notches < 0 {
		button, notches = back, -notches
	}
	return []string{"click", "--repeat", strconv.Itoa(notches), "--delay", "30", button}
}

// resolve answers the display to use, finding or starting one when the last
// one no longer answers.
func (x *X11) resolve(ctx context.Context) (string, error) {
	x.mu.Lock()
	defer x.mu.Unlock()

	var missing []string
	if _, err := exec.LookPath("xdotool"); err != nil {
		missing = append(missing, "xdotool")
	}
	_, noImport := exec.LookPath("import")
	_, noScrot := exec.LookPath("scrot")
	if noImport != nil && noScrot != nil {
		missing = append(missing, "import (ImageMagick) or scrot")
	}
	if len(missing) > 0 {
		return "", fmt.Errorf("%w: %s not installed (%s)", domain.ErrNoScreen, strings.Join(missing, " and "), installHint)
	}

	if x.display != "" && answers(ctx, x.display) {
		return x.display, nil
	}
	for _, candidate := range x.candidates() {
		if answers(ctx, candidate) {
			x.display = candidate
			return candidate, nil
		}
	}
	display, err := x.startVirtual(ctx)
	if err != nil {
		return "", err
	}
	x.display = display
	return display, nil
}

// candidates are the displays that may already be there: the runner's own,
// then every X socket on the machine, lowest first.
func (x *X11) candidates() []string {
	var found []string
	if x.configured != "" {
		found = append(found, x.configured)
	}
	entries, err := os.ReadDir(x11Sockets)
	if err != nil {
		return found
	}
	var numbers []int
	for _, entry := range entries {
		if n, err := strconv.Atoi(strings.TrimPrefix(entry.Name(), "X")); err == nil && strings.HasPrefix(entry.Name(), "X") {
			numbers = append(numbers, n)
		}
	}
	sort.Ints(numbers)
	for _, n := range numbers {
		if display := ":" + strconv.Itoa(n); display != x.configured {
			found = append(found, display)
		}
	}
	return found
}

// startVirtual starts Xvfb on the first free display number and waits until
// it answers. It ends with the runner.
func (x *X11) startVirtual(ctx context.Context) (string, error) {
	if x.virtual != nil {
		_ = x.virtual.Process.Kill()
		_ = x.virtual.Wait()
		x.virtual = nil
	}
	path, err := exec.LookPath("Xvfb")
	if err != nil {
		return "", fmt.Errorf("%w: no X display lets the runner in, and Xvfb is not installed to start a virtual one (%s)",
			domain.ErrNoScreen, installHint)
	}
	number := virtualFirst
	for ; number < virtualFirst+50; number++ {
		if _, err := os.Stat(filepath.Join(x11Sockets, "X"+strconv.Itoa(number))); os.IsNotExist(err) {
			break
		}
	}
	display := ":" + strconv.Itoa(number)
	// Not bound to ctx: the screen outlives the action that first needed it.
	// -noreset: without it the server starts over each time its last client
	// leaves, and an empty screen's only clients are the tools run here, so
	// the pointer would be back in the middle before the next one looked.
	cmd := exec.Command(path, display, "-screen", "0", virtualGeometry, "-nolisten", "tcp", "-noreset") //nolint:gosec,noctx // a fixed program and arguments
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("start Xvfb: %w", err)
	}
	deadline := time.Now().Add(virtualStartup)
	for time.Now().Before(deadline) {
		if answers(ctx, display) {
			x.virtual = cmd
			return display, nil
		}
		select {
		case <-ctx.Done():
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			return "", ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
	_ = cmd.Process.Kill()
	_ = cmd.Wait()
	return "", fmt.Errorf("the virtual screen %s did not start within %s", display, virtualStartup)
}

func answers(ctx context.Context, display string) bool {
	_, _, err := geometry(ctx, display)
	return err == nil
}

// geometry is the display's size in pixels.
func geometry(ctx context.Context, display string) (int, int, error) {
	out, err := run(ctx, xdotoolEnv(display), "xdotool", "getdisplaygeometry")
	if err != nil {
		return 0, 0, err
	}
	var width, height int
	if _, err := fmt.Sscanf(strings.TrimSpace(out), "%d %d", &width, &height); err != nil || width <= 0 || height <= 0 {
		return 0, 0, fmt.Errorf("xdotool reported no screen size: %q", out)
	}
	return width, height, nil
}

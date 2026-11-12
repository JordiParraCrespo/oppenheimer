//go:build linux

package desktop

import (
	"context"
	"errors"
	"image"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// On a host with no display the runner starts a virtual one and drives it
// for real: the pointer goes where it was sent and the capture is the
// screen's size. Skipped where the tools are not installed.
func TestX11StartsAVirtualScreenAndDrivesIt(t *testing.T) {
	for _, tool := range []string{"xdotool", "Xvfb", "xauth"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skipf("%s is not installed", tool)
		}
	}
	_, noImport := exec.LookPath("import")
	_, noScrot := exec.LookPath("scrot")
	if noImport != nil && noScrot != nil {
		t.Skip("neither import nor scrot is installed")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	x := &X11{home: t.TempDir()}
	// The machine's own displays are not this test's to click on.
	display, err := x.startVirtual(ctx)
	if err != nil {
		t.Fatal(err)
	}
	x.display = display
	t.Cleanup(func() {
		// Asked, not killed, so Xvfb removes its socket and lock.
		_ = x.virtual.Process.Signal(syscall.SIGTERM)
		_ = x.virtual.Wait()
	})

	// The screen is locked: a client without its key, as another account on
	// the machine would be, is turned away.
	if _, err := run(ctx, []string{"DISPLAY=" + display, "XAUTHORITY=/dev/null"}, "xdotool", "getdisplaygeometry"); err == nil {
		t.Fatal("the virtual screen let in a client that holds no key")
	}

	screen, err := x.Screen(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if screen.Width != 1280 || screen.Height != 800 || screen.Display != display {
		t.Fatalf("screen = %+v, want 1280 by 800 on %s", screen, display)
	}

	if err := x.Act(ctx, domain.ComputerRequest{Action: domain.ComputerClick, X: 321, Y: 123}); err != nil {
		t.Fatal(err)
	}
	out, err := run(ctx, x.env(display), "xdotool", "getmouselocation")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "x:321 y:123 ") {
		t.Fatalf("pointer at %q, want x:321 y:123", out)
	}
	for _, req := range []domain.ComputerRequest{
		{Action: domain.ComputerScroll, X: 10, Y: 10, ScrollY: 3, ScrollX: -2},
		{Action: domain.ComputerDrag, X: 10, Y: 10, ToX: 200, ToY: 200},
		{Action: domain.ComputerType, Text: "-héllo wörld"},
		{Action: domain.ComputerKey, Keys: []string{"ctrl+a", "cmd+shift+4", "pagedown"}},
	} {
		if err := x.Act(ctx, req); err != nil {
			t.Fatalf("%s: %v", req.Action, err)
		}
	}

	shown, err := x.Capture(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if size := shown.Bounds().Size(); size != image.Pt(1280, 800) {
		t.Fatalf("captured %v, want 1280 by 800", size)
	}
}

// A Wayland desktop's X displays are XWayland's: driven, they answer with a
// blank picture and clicks nothing receives. It is refused as no screen,
// with what the person can do, before any display is tried or started.
func TestX11RefusesAWaylandDesktop(t *testing.T) {
	for _, tool := range []string{"xdotool", "import"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skipf("%s is not installed", tool)
		}
	}
	x := &X11{wayland: true, home: t.TempDir()}
	_, err := x.Screen(context.Background())
	if !errors.Is(err, domain.ErrNoScreen) || !strings.Contains(err.Error(), "Wayland") {
		t.Fatalf("Screen = %v, want ErrNoScreen naming Wayland", err)
	}
	if x.virtual != nil {
		t.Fatal("a virtual screen was started on a Wayland desktop")
	}
}

func TestWaylandSessionIsReadFromTheEnvironmentOrTheSessionSocket(t *testing.T) {
	empty := t.TempDir()
	if WaylandSession("x11", "", empty) || WaylandSession("", "", empty) {
		t.Fatal("an X11 session, or none, read as Wayland")
	}
	if !WaylandSession("wayland", "", empty) || !WaylandSession("", "wayland-0", empty) {
		t.Fatal("a Wayland session's own variables were not read")
	}
	// A user service started outside the session has neither variable.
	withSocket := t.TempDir()
	if err := os.WriteFile(filepath.Join(withSocket, "wayland-0"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if !WaylandSession("", "", withSocket) {
		t.Fatal("the session's socket was not read")
	}
}

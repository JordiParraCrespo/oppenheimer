//go:build linux

package desktop

import (
	"context"
	"image"
	"os/exec"
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
	for _, tool := range []string{"xdotool", "Xvfb"} {
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

	x := &X11{}
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
	out, err := run(ctx, []string{"DISPLAY=" + display}, "xdotool", "getmouselocation")
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

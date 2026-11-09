package cli

import (
	"context"
	"io"
	"runtime"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ComputerShow prints whether bots may use this host's screen, and the
// screen they would use (`runner computer`).
func (a *App) ComputerShow(ctx context.Context, out io.Writer) error {
	policy, err := a.Host.ComputerPolicy()
	if err != nil {
		return err
	}
	p := newPrinter(out)
	if policy.Enabled {
		p.printf("computer: on\n")
		p.printf("          bots may see this screen and use its mouse and keyboard, as this account\n")
	} else {
		p.printf("computer: off\n")
		p.printf("          bots see and touch nothing here (runner computer on)\n")
	}
	switch screen, err := a.Host.ComputerScreen(ctx); {
	case err != nil:
		p.printf("screen:   none: %v\n", err)
	case screen.Display != "":
		p.printf("screen:   %d x %d on display %s\n", screen.Width, screen.Height, screen.Display)
	default:
		p.printf("screen:   %d x %d\n", screen.Width, screen.Height)
	}
	if runtime.GOOS == "darwin" {
		p.printf("          macOS must also allow the runner under Screen Recording and Accessibility\n")
		p.printf("          (System Settings > Privacy & Security); without the first a bot sees no windows\n")
	}
	p.printf("file:     %s\n", a.Paths.ComputerPolicy())
	return p.err
}

// ComputerSet turns it on or off (`runner computer on|off`). The running
// service reads the file on every action, so nothing restarts.
func (a *App) ComputerSet(ctx context.Context, out io.Writer, enabled bool) error {
	if err := a.Host.SetComputerPolicy(hostdomain.ComputerPolicy{Enabled: enabled}); err != nil {
		return err
	}
	return a.ComputerShow(ctx, out)
}

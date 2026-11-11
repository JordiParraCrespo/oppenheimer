package cli

import (
	"io"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// BrowserShow prints whether bots may drive a browser on this host, and the
// browser they would get (`runner browser`).
func (a *App) BrowserShow(out io.Writer) error {
	policy, err := a.Host.BrowserPolicy()
	if err != nil {
		return err
	}
	p := newPrinter(out)
	if policy.Enabled {
		p.printf("browser:  on\n")
		p.printf("          each bot may drive a browser of its own here, with whatever this machine reaches\n")
	} else {
		p.printf("browser:  off\n")
		p.printf("          bots open no browser here (runner browser on)\n")
	}
	if program, err := a.Host.BrowserAvailable(); err != nil {
		p.printf("program:  none: %v\n", err)
	} else {
		p.printf("program:  %s\n", program)
	}
	p.printf("profiles: %s/<bot> (never your own browser's)\n", a.Paths.Browsers())
	p.printf("file:     %s\n", a.Paths.BrowserPolicy())
	return p.err
}

// BrowserSet turns it on or off (`runner browser on|off`). The running
// service reads the file on every action, so nothing restarts.
func (a *App) BrowserSet(out io.Writer, enabled bool) error {
	if err := a.Host.SetBrowserPolicy(hostdomain.BrowserPolicy{Enabled: enabled}); err != nil {
		return err
	}
	return a.BrowserShow(out)
}

package cli

import (
	"io"
	"path/filepath"

	desktopdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

// DesktopOptions are what `runner desktop on` sets; a zero field keeps what
// was saved.
type DesktopOptions struct {
	Port         int
	Username     string
	PasswordFile string
}

// DesktopShow prints whether and how this host shares its screen
// (`runner desktop`).
func (a *App) DesktopShow(out io.Writer) error {
	settings, err := a.Desktop.Settings()
	if err != nil {
		return err
	}
	p := newPrinter(out)
	if settings.Enabled {
		p.printf("desktop:  shared; the console can watch this screen, and click and type once you take control\n")
	} else {
		p.printf("desktop:  not shared (runner desktop on shares it)\n")
	}
	p.printf("server:   127.0.0.1:%d\n", settings.ServerPort())
	if settings.Username != "" {
		p.printf("account:  %s\n", settings.Username)
	}
	if settings.PasswordFile != "" {
		p.printf("password: %s\n", settings.PasswordFile)
	} else {
		p.printf("password: none (a server that asks for one is refused)\n")
	}
	p.printf("file:     %s\n", a.Paths.Desktop())
	return p.err
}

// DesktopOn shares this host's screen with the console (`runner desktop on`).
// It does not start a screen-sharing server: macOS Screen Sharing, TigerVNC
// or x11vnc, listening on the loopback, is the owner's to run.
func (a *App) DesktopOn(out io.Writer, opts DesktopOptions) error {
	settings, err := a.Desktop.Settings()
	if err != nil {
		return err
	}
	settings.Enabled = true
	if opts.Port != 0 {
		settings.Port = opts.Port
	}
	if opts.Username != "" {
		settings.Username = opts.Username
	}
	if opts.PasswordFile != "" {
		path, err := filepath.Abs(opts.PasswordFile)
		if err != nil {
			return desktopdomain.ErrInvalidInput.WithDetail("%v", err)
		}
		settings.PasswordFile = path
	}
	if err := a.Desktop.SetSettings(settings); err != nil {
		return err
	}
	return a.DesktopShow(out)
}

// DesktopOff stops sharing this host's screen (`runner desktop off`). A
// stream already open ends at its next open; the settings stay for `on`.
func (a *App) DesktopOff(out io.Writer) error {
	settings, err := a.Desktop.Settings()
	if err != nil {
		return err
	}
	settings.Enabled = false
	if err := a.Desktop.SetSettings(settings); err != nil {
		return err
	}
	return a.DesktopShow(out)
}

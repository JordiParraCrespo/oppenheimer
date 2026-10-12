package system

import (
	"context"
	"errors"
	"fmt"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Installer = Installer{}

// Installer runs a catalog install script on this machine.
type Installer struct{}

// Install implements app.Installer. The script runs under `sh -c` in a
// process group of its own, so a vendor installer that spawns curl, npm or
// brew takes them down with it on timeout, and with nothing on stdin, so one
// that would ask reads end-of-file and gives up instead of hanging. The
// script is catalog data compiled into this binary; nothing in it comes from
// the caller.
func (Installer) Install(ctx context.Context, _, script string) error {
	_, err := execx.Run(ctx, execx.Spec{
		Name:      "/bin/sh",
		Args:      []string{"-c", script},
		Timeout:   domain.ToolInstallTimeout,
		KillGroup: true,
		Output:    execx.Combined,
	})
	var run *execx.Error
	switch {
	case err == nil:
		return nil
	case errors.As(err, &run) && run.TimedOut:
		return fmt.Errorf("gave up after %s", domain.ToolInstallTimeout)
	case errors.As(err, &run) && run.LastLine != "":
		return errors.New(run.LastLine)
	default:
		return err
	}
}

package system

import (
	"context"
	"errors"
	"fmt"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Updater = Updater{}

// Updater runs an agent CLI's own updater on this machine.
type Updater struct{}

// Update implements app.Updater. The command runs in a process group of its
// own, so an updater that spawns a package manager takes it down with it on
// timeout, and with nothing on stdin. The error names the reason: the
// updater's last line of output, which is where every one of them prints it.
func (Updater) Update(ctx context.Context, _, path string, args []string) error {
	_, err := execx.Run(ctx, execx.Spec{
		Name:      path,
		Args:      args,
		Timeout:   domain.AgentUpdateTimeout,
		KillGroup: true,
		Output:    execx.Combined,
	})
	var run *execx.Error
	switch {
	case err == nil:
		return nil
	case errors.As(err, &run) && run.TimedOut:
		return fmt.Errorf("gave up after %s", domain.AgentUpdateTimeout)
	case errors.As(err, &run) && run.LastLine != "":
		return errors.New(run.LastLine)
	default:
		return err
	}
}

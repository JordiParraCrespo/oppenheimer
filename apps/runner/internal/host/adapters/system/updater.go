package system

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Updater = Updater{}

// Updater runs an agent CLI's own updater on this machine.
type Updater struct{}

// Update implements app.Updater. The command runs in a process group of its
// own, so an updater that spawns a package manager takes it down with it on
// timeout, and with nothing on stdin, so one that stops to ask a question
// gets end-of-file and fails rather than hanging until the timeout.
func (Updater) Update(ctx context.Context, path string, args []string) (string, error) {
	res, err := execx.Run(ctx, execx.Spec{
		Name:      path,
		Args:      args,
		Timeout:   domain.AgentUpdateTimeout,
		KillGroup: true,
		Output:    execx.Combined,
	})
	return res.Out, err
}

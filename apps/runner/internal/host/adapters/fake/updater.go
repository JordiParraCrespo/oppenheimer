package fake

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
)

var _ app.Updater = (*Updater)(nil)

// Updater records the updaters it was asked to run and answers with Run, so a
// test decides per tool whether the version moves or the command fails.
type Updater struct {
	// Run is called for every update; nil succeeds.
	Run func(path string, args []string) error
	// Calls records "<path> <args…>" in order.
	Calls []string
	// Envs records each call's env, in the same order.
	Envs [][]string
}

// Update implements app.Updater.
func (u *Updater) Update(_ context.Context, _, path string, args, env []string) error {
	call := path
	for _, arg := range args {
		call += " " + arg
	}
	u.Calls = append(u.Calls, call)
	u.Envs = append(u.Envs, env)
	if u.Run == nil {
		return nil
	}
	return u.Run(path, args)
}

package fake

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
)

var _ app.Installer = (*Installer)(nil)

// Installer records the tools it was asked to install and answers with Run,
// so a test decides whether the install puts the tool on PATH or fails.
type Installer struct {
	// Run is called for every install; nil succeeds.
	Run func(tool, script string) error
	// Calls records the tool names in order.
	Calls []string
}

// Install implements app.Installer.
func (i *Installer) Install(_ context.Context, tool, script string) error {
	i.Calls = append(i.Calls, tool)
	if i.Run == nil {
		return nil
	}
	return i.Run(tool, script)
}

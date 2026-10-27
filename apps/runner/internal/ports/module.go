// Package ports wires a session's forwarded ports: the listeners its own
// processes hold, reached from the host's loopback for the console's preview
// (product/versions/mvp/30-session-previews.md).
package ports

import (
	"runtime"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/adapters/lsof"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/adapters/procfs"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/app"
)

// New builds the context for this platform, or nil where the runner cannot
// tell which process holds a socket.
func New() *app.Service {
	switch runtime.GOOS {
	case "linux":
		return app.New(app.Options{Listeners: procfs.Listeners{}})
	case "darwin":
		return app.New(app.Options{Listeners: lsof.Listeners{}})
	default:
		return nil
	}
}

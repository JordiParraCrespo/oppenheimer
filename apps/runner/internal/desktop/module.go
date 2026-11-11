// Package desktop wires a host's desktop: the screen-sharing server on its
// loopback, shared with the console when the host's owner turns it on
// (`runner desktop on`), signed in to with credentials that stay on the host.
package desktop

import (
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/adapters/settingsfile"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/app"
)

// New builds the context over the settings file at path.
func New(path string) *app.Service {
	file := settingsfile.File{Path: path}
	return app.New(app.Options{Settings: file, Secrets: file})
}

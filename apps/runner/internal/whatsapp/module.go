// Package whatsapp wires the host's WhatsApp linked device
// (product/next-steps/whatsapp.md): one device per host, its keys in the
// runner's state directory, the messages it receives handed to the control
// plane over the link.
package whatsapp

import (
	"log/slog"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/adapters/whatsmeow"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
)

// New builds the context over the state directory dir. Nothing is opened
// until the service starts.
func New(dir string, logger *slog.Logger) *app.Service {
	device := whatsmeow.New(whatsmeow.Options{Dir: dir, Logger: logger})
	return app.New(app.Options{Device: device, Outbox: device, Logger: logger})
}

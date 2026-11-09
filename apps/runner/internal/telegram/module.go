// Package telegram wires the host's Telegram bot
// (product/next-steps/telegram.md): one bot per host, its token in the
// runner's state directory, the messages it receives handed to the control
// plane over the link.
package telegram

import (
	"log/slog"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/adapters/botapi"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
)

// New builds the context over the state directory dir. Nothing is read
// until the service starts.
func New(dir string, logger *slog.Logger) *app.Service {
	return app.New(app.Options{
		API:    botapi.NewClient("", nil),
		Store:  botapi.NewStore(dir, logger),
		Logger: logger,
	})
}

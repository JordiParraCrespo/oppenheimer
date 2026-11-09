package cli

// The host's Telegram bot on the link (product/next-steps/telegram.md):
// `telegram.link`, `telegram.unlink`, `telegram.send` and `telegram.ack`
// from the control plane, `telegram.state` and `telegram.messages` to it. The
// bot lives on the daemon's context, not a link's: a link that drops leaves
// it polling, and what arrives meanwhile waits in its outbox. The token a
// `telegram.link` carries is handed to the service and never logged.

import (
	"context"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram"
	tgapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	tgdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// Telegram's lanes: connecting and disconnecting run one after another on
// one, sends in the order they came on another, so a send paced behind a
// group's limit holds up no connect.
const (
	laneTelegramLink = "telegram:link"
	laneTelegramSend = "telegram:send"
	laneTelegramAck  = "telegram:ack"
)

// telegramCallTimeout bounds a connect or a send: Telegram answers in
// seconds, and a send may wait its pacing (tgdomain.MaxWait) first.
const telegramCallTimeout = 30 * time.Second

// startTelegram builds the bot (unless the host offers none) and starts it on
// the daemon's context, reporting through the link.
func (h *linkHandler) startTelegram(logger *slog.Logger) {
	if h.app.Telegram == nil && TelegramEnabled() {
		h.app.Telegram = telegram.New(h.app.Paths.Telegram(), logger)
	}
	h.telegram = h.app.Telegram
	if h.telegram == nil {
		return
	}
	h.telegram.SetPublisher(telegramPublisher{h: h})
	if err := h.telegram.Start(h.life); err != nil {
		logger.Error("telegram: the bot's store could not be read; Telegram is off on this host", slog.Any("error", err))
	}
}

// telegramLinkUp tells a new link how the bot stands and hands it what waits.
func (h *linkHandler) telegramLinkUp() {
	if h.telegram == nil {
		return
	}
	go h.telegram.LinkUp(h.life)
}

func (h *linkHandler) telegramMessage(msg link.Message) {
	switch msg.Type {
	case link.TypeTelegramLink:
		var m link.TelegramLink
		if msg.Decode(&m) == nil {
			h.lanes.run(laneTelegramLink, func() {
				if h.telegram == nil {
					h.fail(m.CommandID, tgdomain.ErrNotConnected.WithDetail("this host offers no Telegram bot"))
					return
				}
				ctx, cancel := context.WithTimeout(h.life, telegramCallTimeout)
				defer cancel()
				if err := h.telegram.Link(ctx, m.Token); err != nil {
					h.fail(m.CommandID, err)
				}
			})
		}
	case link.TypeTelegramUnlink:
		var m link.TelegramUnlink
		if msg.Decode(&m) == nil {
			h.lanes.run(laneTelegramLink, func() {
				if h.telegram == nil {
					_ = h.client.Send(link.TelegramState{Type: link.TypeTelegramState, State: string(tgdomain.StateUnlinked)})
					return
				}
				if err := h.telegram.Unlink(h.life); err != nil {
					h.fail(m.CommandID, err)
				}
			})
		}
	case link.TypeTelegramSend:
		var m link.TelegramSend
		if msg.Decode(&m) == nil {
			h.lanes.run(laneTelegramSend, func() { h.telegramSend(m) })
		}
	case link.TypeTelegramAck:
		var m link.TelegramAck
		if msg.Decode(&m) == nil && h.telegram != nil {
			h.lanes.run(laneTelegramAck, func() { h.telegram.Ack(h.life, m.Keys) })
		}
	}
}

func (h *linkHandler) telegramSend(m link.TelegramSend) {
	if h.telegram == nil {
		h.fail(m.CommandID, tgdomain.ErrNotConnected.WithDetail("this host offers no Telegram bot"))
		return
	}
	ctx, cancel := context.WithTimeout(h.life, telegramCallTimeout)
	defer cancel()
	id, at, err := h.telegram.Send(ctx, m.ChatID, m.Text, m.ReplyToID)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	_ = h.client.Send(link.TelegramSent{Type: link.TypeTelegramSent, CommandID: m.CommandID, ID: id, SentAt: at})
}

// telegramPublisher is the link, as the Telegram service reports to it.
type telegramPublisher struct{ h *linkHandler }

var _ tgapp.Publisher = telegramPublisher{}

func (p telegramPublisher) State(status tgdomain.Status) {
	// A state lost to a link that is down is replaced by the one LinkUp sends.
	_ = p.h.client.Send(link.TelegramState{
		Type: link.TypeTelegramState, State: string(status.State),
		BotID: status.Bot.ID, Username: tgdomain.Fit(status.Bot.Username, 64),
		Name: tgdomain.Fit(status.Bot.Name, 200), Reason: tgdomain.Fit(status.Reason, 200),
	})
}

func (p telegramPublisher) Messages(batch []tgdomain.Inbound) bool {
	out := link.TelegramMessages{Type: link.TypeTelegramMessages, Messages: make([]link.TelegramMessagesMessages, 0, len(batch))}
	for _, m := range batch {
		out.Messages = append(out.Messages, link.TelegramMessagesMessages{
			Key: m.Key, ID: m.ID, ChatID: m.ChatID, ChatKind: string(m.ChatKind), ChatName: m.ChatName,
			SenderID: m.SenderID, SenderName: m.SenderName, SenderUsername: m.SenderUsername,
			Text: m.Text, Media: m.Media, ReplyToID: m.ReplyToID, SentAt: m.SentAt,
		})
	}
	return p.h.client.Send(out) == nil
}

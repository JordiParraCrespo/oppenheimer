package cli

// The host's WhatsApp linked device on the link (product/next-steps/whatsapp.md):
// `whatsapp.link`, `whatsapp.unlink`, `whatsapp.send` and `whatsapp.ack`
// from the control plane, `whatsapp.state` and `whatsapp.messages` to it. The
// device lives on the daemon's context, not a link's: a link that drops
// leaves it connected, and what arrives meanwhile waits in its outbox.

import (
	"context"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp"
	waapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	wadomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// WhatsApp's lanes: pairing waits minutes for a scan, so it has one of its
// own, and sends run one after another on another, in the order they came.
const (
	laneWhatsAppPair = "whatsapp:pair"
	laneWhatsAppSend = "whatsapp:send"
	laneWhatsAppAck  = "whatsapp:ack"
)

// startWhatsApp builds the device (unless the host offers none) and opens it
// on the daemon's context, reporting through the link.
func (h *linkHandler) startWhatsApp(logger *slog.Logger) {
	if h.app.WhatsApp == nil && WhatsAppEnabled() {
		h.app.WhatsApp = whatsapp.New(h.app.Paths.WhatsApp(), logger)
	}
	h.whatsapp = h.app.WhatsApp
	if h.whatsapp == nil {
		return
	}
	h.whatsapp.SetPublisher(whatsAppPublisher{h: h})
	go func() {
		if err := h.whatsapp.Start(h.life); err != nil {
			logger.Error("whatsapp: the device store could not be opened; WhatsApp is off on this host", slog.Any("error", err))
		}
	}()
}

// whatsAppLinkUp tells a new link how the device stands and hands it what
// waits, off the read loop.
func (h *linkHandler) whatsAppLinkUp() {
	if h.whatsapp == nil {
		return
	}
	go h.whatsapp.LinkUp(h.life)
}

func (h *linkHandler) whatsAppMessage(msg link.Message) {
	switch msg.Type {
	case link.TypeWhatsappLink:
		var m link.WhatsappLink
		if msg.Decode(&m) == nil {
			h.lanes.run(laneWhatsAppPair, func() {
				if h.whatsapp == nil {
					h.fail(m.CommandID, wadomain.ErrNotConnected.WithDetail("this host offers no WhatsApp device"))
					return
				}
				if err := h.whatsapp.Link(h.life); err != nil {
					h.fail(m.CommandID, err)
				}
			})
		}
	case link.TypeWhatsappUnlink:
		var m link.WhatsappUnlink
		if msg.Decode(&m) == nil {
			h.lanes.run(laneWhatsAppSend, func() {
				if h.whatsapp == nil {
					_ = h.client.Send(link.WhatsappState{Type: link.TypeWhatsappState, State: string(wadomain.StateUnlinked)})
					return
				}
				if err := h.whatsapp.Unlink(h.life); err != nil {
					h.fail(m.CommandID, err)
				}
			})
		}
	case link.TypeWhatsappSend:
		var m link.WhatsappSend
		if msg.Decode(&m) == nil {
			h.lanes.run(laneWhatsAppSend, func() { h.whatsAppSend(m) })
		}
	case link.TypeWhatsappAck:
		var m link.WhatsappAck
		if msg.Decode(&m) == nil && h.whatsapp != nil {
			h.lanes.run(laneWhatsAppAck, func() { h.whatsapp.Ack(h.life, m.Keys) })
		}
	}
}

// whatsAppSendTimeout bounds one send: WhatsApp answers in seconds, and a
// control plane waiting on the reply has given up long before a minute.
const whatsAppSendTimeout = 30 * time.Second

func (h *linkHandler) whatsAppSend(m link.WhatsappSend) {
	if h.whatsapp == nil {
		h.fail(m.CommandID, wadomain.ErrNotConnected.WithDetail("this host offers no WhatsApp device"))
		return
	}
	ctx, cancel := context.WithTimeout(h.life, whatsAppSendTimeout)
	defer cancel()
	id, at, err := h.whatsapp.Send(ctx, m.ChatID, m.Text)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	_ = h.client.Send(link.WhatsappSent{Type: link.TypeWhatsappSent, CommandID: m.CommandID, ID: id, SentAt: at})
}

// whatsAppPublisher is the link, as the WhatsApp service reports to it.
type whatsAppPublisher struct{ h *linkHandler }

var _ waapp.Publisher = whatsAppPublisher{}

func (p whatsAppPublisher) State(status wadomain.Status) {
	out := link.WhatsappState{
		Type: link.TypeWhatsappState, State: string(status.State),
		Qr: status.QR, Phone: status.Phone, Name: wadomain.Fit(status.Name, 200), Reason: wadomain.Fit(status.Reason, 200),
	}
	if !status.QRExpiresAt.IsZero() {
		expires := status.QRExpiresAt.UTC()
		out.QrExpiresAt = &expires
	}
	// A state lost to a link that is down is replaced by the one LinkUp sends.
	_ = p.h.client.Send(out)
}

func (p whatsAppPublisher) Messages(batch []wadomain.Inbound) bool {
	out := link.WhatsappMessages{Type: link.TypeWhatsappMessages, Messages: make([]link.WhatsappInbound, 0, len(batch))}
	for _, m := range batch {
		out.Messages = append(out.Messages, link.WhatsappInbound{
			Key: m.Key, ID: m.ID, ChatID: m.ChatID, ChatKind: string(m.ChatKind),
			ChatName: wadomain.Fit(m.ChatName, 200), SenderID: m.SenderID, SenderName: wadomain.Fit(m.SenderName, 200),
			FromMe: m.FromMe, Text: m.Text, Media: m.Media, QuotedID: m.QuotedID, SentAt: m.SentAt,
		})
	}
	return p.h.client.Send(out) == nil
}

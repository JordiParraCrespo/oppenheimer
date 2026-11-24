package cli

// The host's WhatsApp linked device on the link:
// `whatsapp.link`, `whatsapp.unlink`, `whatsapp.send`, `whatsapp.send.voice`,
// `whatsapp.ack` and `whatsapp.media.get` from the control plane, `whatsapp.state`,
// `whatsapp.messages` and `whatsapp.media` to it. The
// device lives on the daemon's context, not a link's: a link that drops
// leaves it connected, and what arrives meanwhile waits in its outbox.

import (
	"context"
	"encoding/base64"
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
	// Voice notes and images download on a lane of their own, so a slow one
	// never holds a send back.
	laneWhatsAppMedia = "whatsapp:media"
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
	case link.TypeWhatsappSendVoice:
		var m link.WhatsappSendVoice
		if msg.Decode(&m) == nil {
			h.lanes.run(laneWhatsAppSend, func() { h.whatsAppSendVoice(m) })
		}
	case link.TypeWhatsappAck:
		var m link.WhatsappAck
		if msg.Decode(&m) == nil && h.whatsapp != nil {
			h.lanes.run(laneWhatsAppAck, func() { h.whatsapp.Ack(h.life, m.Keys) })
		}
	case link.TypeWhatsappMediaGet:
		var m link.WhatsappMediaGet
		if msg.Decode(&m) == nil {
			h.lanes.run(laneWhatsAppMedia, func() { h.whatsAppMedia(m) })
		}
	}
}

// whatsAppMediaTimeout bounds one download of a voice note or an image; the
// control plane gives up on it a little later.
const whatsAppMediaTimeout = 40 * time.Second

func (h *linkHandler) whatsAppMedia(m link.WhatsappMediaGet) {
	if h.whatsapp == nil {
		h.fail(m.CommandID, wadomain.ErrNotConnected.WithDetail("this host offers no WhatsApp device"))
		return
	}
	ctx, cancel := context.WithTimeout(h.life, whatsAppMediaTimeout)
	defer cancel()
	fetch, fallback := h.whatsapp.VoiceNote, "audio/ogg; codecs=opus"
	if m.Kind == "image" {
		fetch, fallback = h.whatsapp.Image, wadomain.ImageMimetype
	}
	data, mimetype, err := fetch(ctx, m.ChatID, m.MessageID)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	if mimetype == "" {
		mimetype = fallback
	}
	_ = h.client.Send(link.WhatsappMedia{
		Type: link.TypeWhatsappMedia, CommandID: m.CommandID,
		Mimetype: wadomain.Fit(mimetype, 128), Data: base64.StdEncoding.EncodeToString(data),
	})
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
	// An older control plane sends no replyTo, and the message goes unquoted.
	var quote *wadomain.Quote
	if m.ReplyTo != nil {
		quote = &wadomain.Quote{ID: m.ReplyTo.ID, SenderID: m.ReplyTo.SenderID}
	}
	id, at, err := h.whatsapp.Send(ctx, m.ChatID, m.Text, quote)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	_ = h.client.Send(link.WhatsappSent{Type: link.TypeWhatsappSent, CommandID: m.CommandID, ID: id, SentAt: at})
}

// whatsAppVoiceSendTimeout bounds one voice note: an upload to WhatsApp's
// media servers, then the send. The control plane gives up a little later.
const whatsAppVoiceSendTimeout = 40 * time.Second

func (h *linkHandler) whatsAppSendVoice(m link.WhatsappSendVoice) {
	if h.whatsapp == nil {
		h.fail(m.CommandID, wadomain.ErrNotConnected.WithDetail("this host offers no WhatsApp device"))
		return
	}
	audio, err := base64.StdEncoding.DecodeString(m.Data)
	if err != nil {
		h.fail(m.CommandID, wadomain.ErrNotVoiceNote.WithDetail("the audio is not base64"))
		return
	}
	ctx, cancel := context.WithTimeout(h.life, whatsAppVoiceSendTimeout)
	defer cancel()
	id, at, err := h.whatsapp.SendVoice(ctx, m.ChatID, audio, m.Seconds)
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

func (p whatsAppPublisher) Chats(batch []wadomain.KnownChat) {
	out := link.WhatsappChats{Type: link.TypeWhatsappChats, Chats: make([]link.WhatsappKnownChat, 0, len(batch))}
	for _, c := range batch {
		out.Chats = append(out.Chats, link.WhatsappKnownChat{
			ChatID: c.ChatID, ChatKind: string(c.Kind), ChatName: wadomain.Fit(c.Name, 200),
		})
	}
	// A list lost to a link that is down goes again with the next LinkUp.
	_ = p.h.client.Send(out)
}

func (p whatsAppPublisher) Messages(batch []wadomain.Inbound) bool {
	out := link.WhatsappMessages{Type: link.TypeWhatsappMessages, Messages: make([]link.WhatsappInbound, 0, len(batch))}
	for _, m := range batch {
		out.Messages = append(out.Messages, link.WhatsappInbound{
			Key: m.Key, ID: m.ID, ChatID: m.ChatID, ChatKind: string(m.ChatKind),
			ChatName: wadomain.Fit(m.ChatName, 200), SenderID: m.SenderID, SenderName: wadomain.Fit(m.SenderName, 200),
			FromMe: m.FromMe, Text: m.Text, Media: m.Media, QuotedID: m.QuotedID,
			QuotedSenderID: m.QuotedSenderID, Mentions: m.Mentions,
			VoiceSeconds: m.VoiceSeconds, SentAt: m.SentAt,
		})
	}
	return p.h.client.Send(out) == nil
}

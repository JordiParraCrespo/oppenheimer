package whatsmeow

import (
	"context"
	"log/slog"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// names resolves the names WhatsApp itself does not put on a message: a
// group's subject, a contact's name. Empty is unknown.
type names interface {
	chatName(chat types.JID) string
}

// lidMap turns a `@lid` id into the phone-number JID it stands for, an empty
// JID when it knows none: the device store's LID map (store.LIDStore) is one.
type lidMap interface {
	GetPNForLID(ctx context.Context, lid types.JID) (types.JID, error)
}

// reader reads whatsmeow messages with what the device knows beyond them.
type reader struct {
	names names
	// lids, when set, gives the phone number behind a `@lid` id that arrives
	// without one.
	lids   lidMap
	logger *slog.Logger
}

// received reads a whatsmeow message into the domain's shape. Whether it is
// one to hand on is the domain's to decide (domain.Admit): this only says
// where it was sent and what it carries.
func (rd reader) received(ctx context.Context, evt *events.Message) domain.Received {
	info := evt.Info
	r := domain.Received{
		Where:      whereOf(info.Chat),
		ID:         info.ID,
		ChatID:     info.Chat.ToNonAD().String(),
		ChatKind:   domain.ChatDirect,
		SenderID:   rd.phoneOf(ctx, info.Sender, info.SenderAlt).String(),
		SenderName: info.PushName,
		FromMe:     info.IsFromMe,
		SentAt:     info.Timestamp.UTC(),
	}
	if info.Chat.Server == types.GroupServer {
		r.ChatKind = domain.ChatGroup
	} else if r.Where == domain.WhereChat {
		// A direct chat is the other person: the sender's alternative address
		// when they wrote, the recipient's when this number did.
		alt := info.SenderAlt
		if info.IsFromMe {
			alt = info.RecipientAlt
		}
		r.ChatID = rd.phoneOf(ctx, info.Chat, alt).String()
	}
	if rd.names != nil && r.Where == domain.WhereChat {
		r.ChatName = rd.names.chatName(info.Chat)
	}
	if r.ChatKind == domain.ChatDirect && r.ChatName == "" && !info.IsFromMe {
		r.ChatName = info.PushName
	}
	r.Text, r.Media, r.QuotedID = content(evt.Message)
	return r
}

// phoneOf is who as a phone-number JID when it is a `@lid` id and its number
// is known: alt when WhatsApp gave it, else the device's LID map. The owner
// is named by phone number, and a person must keep one id across messages,
// so the number wins. An id whose number is unknown stays as it is.
func (rd reader) phoneOf(ctx context.Context, who, alt types.JID) types.JID {
	who = who.ToNonAD()
	if who.Server != types.HiddenUserServer {
		return who
	}
	if alt.Server == types.DefaultUserServer {
		return alt.ToNonAD()
	}
	if rd.lids == nil {
		return who
	}
	pn, err := rd.lids.GetPNForLID(ctx, who)
	if err == nil && pn.Server == types.DefaultUserServer {
		return pn.ToNonAD()
	}
	if rd.logger != nil {
		rd.logger.Debug("whatsapp: no phone number is known for a @lid id; the message keeps it", slog.Any("error", err))
	}
	return who
}

// outgoing is the message Send sends: plain text, or, quoting quote, an
// extended text whose context names the message replied to and its sender.
// The quoted message's own text is not known here, so it goes empty;
// WhatsApp finds the original by its id.
func outgoing(text string, quote *domain.Quote) *waE2E.Message {
	if quote == nil || quote.ID == "" {
		return &waE2E.Message{Conversation: proto.String(text)}
	}
	info := &waE2E.ContextInfo{
		StanzaID:      proto.String(quote.ID),
		QuotedMessage: &waE2E.Message{Conversation: proto.String("")},
	}
	if quote.SenderID != "" {
		info.Participant = proto.String(quote.SenderID)
	}
	return &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{Text: proto.String(text), ContextInfo: info}}
}

func whereOf(chat types.JID) domain.Where {
	switch {
	case chat.Server == types.BroadcastServer && chat.User == types.StatusBroadcastJID.User:
		return domain.WhereStatus
	case chat.Server == types.BroadcastServer:
		return domain.WhereBroadcast
	case chat.Server == types.NewsletterServer:
		return domain.WhereNewsletter
	}
	return domain.WhereChat
}

// content is a message's text (or a media message's caption), its media
// kind, and the id of the message it quotes. Reactions, edits, polls and
// protocol messages carry neither text nor media here, and are not read yet.
func content(m *waE2E.Message) (text, media, quoted string) {
	if m == nil {
		return "", "", ""
	}
	var ctxInfo *waE2E.ContextInfo
	switch {
	case m.GetConversation() != "":
		text = m.GetConversation()
	case m.GetExtendedTextMessage() != nil:
		text, ctxInfo = m.GetExtendedTextMessage().GetText(), m.GetExtendedTextMessage().GetContextInfo()
	case m.GetImageMessage() != nil:
		text, media, ctxInfo = m.GetImageMessage().GetCaption(), domain.MediaImage, m.GetImageMessage().GetContextInfo()
	case m.GetVideoMessage() != nil:
		text, media, ctxInfo = m.GetVideoMessage().GetCaption(), domain.MediaVideo, m.GetVideoMessage().GetContextInfo()
	case m.GetAudioMessage() != nil:
		media, ctxInfo = domain.MediaAudio, m.GetAudioMessage().GetContextInfo()
	case m.GetDocumentMessage() != nil:
		doc := m.GetDocumentMessage()
		text, media, ctxInfo = doc.GetCaption(), domain.MediaDocument, doc.GetContextInfo()
		if text == "" {
			text = doc.GetFileName()
		}
	case m.GetStickerMessage() != nil:
		media, ctxInfo = domain.MediaSticker, m.GetStickerMessage().GetContextInfo()
	case m.GetContactMessage() != nil:
		text, media, ctxInfo = m.GetContactMessage().GetDisplayName(), domain.MediaContact, m.GetContactMessage().GetContextInfo()
	case m.GetLocationMessage() != nil:
		loc := m.GetLocationMessage()
		text, media, ctxInfo = loc.GetName(), domain.MediaLocation, loc.GetContextInfo()
	}
	return text, media, ctxInfo.GetStanzaID()
}

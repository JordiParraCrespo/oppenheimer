package whatsmeow

import (
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// names resolves the names WhatsApp itself does not put on a message: a
// group's subject, a contact's name. Empty is unknown.
type names interface {
	chatName(chat types.JID) string
}

// received reads a whatsmeow message into the domain's shape. Whether it is
// one to hand on is the domain's to decide (domain.Admit): this only says
// where it was sent and what it carries.
func received(evt *events.Message, n names) domain.Received {
	info := evt.Info
	r := domain.Received{
		Where:      whereOf(info.Chat),
		ID:         info.ID,
		ChatID:     info.Chat.ToNonAD().String(),
		ChatKind:   domain.ChatDirect,
		SenderID:   senderOf(info.MessageSource).String(),
		SenderName: info.PushName,
		FromMe:     info.IsFromMe,
		SentAt:     info.Timestamp.UTC(),
	}
	if info.Chat.Server == types.GroupServer {
		r.ChatKind = domain.ChatGroup
	}
	if n != nil && r.Where == domain.WhereChat {
		r.ChatName = n.chatName(info.Chat)
	}
	if r.ChatKind == domain.ChatDirect && r.ChatName == "" && !info.IsFromMe {
		r.ChatName = info.PushName
	}
	r.Text, r.Media, r.QuotedID = content(evt.Message)
	return r
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

// senderOf prefers the sender's phone-number JID: under LID addressing the
// sender is a `@lid` id, and its number, when WhatsApp gives it, is the one
// the owner would recognise.
func senderOf(source types.MessageSource) types.JID {
	sender := source.Sender.ToNonAD()
	if sender.Server == types.HiddenUserServer && source.SenderAlt.Server == types.DefaultUserServer {
		return source.SenderAlt.ToNonAD()
	}
	return sender
}

// content is a message's text (or a media message's caption), its media
// kind, and the id of the message it quotes. Reactions, edits, polls and
// protocol messages carry neither text nor media here, and are not read yet.
func content(m *waE2E.Message) (text, media, quoted string) {
	if m == nil {
		return "", "", ""
	}
	var context *waE2E.ContextInfo
	switch {
	case m.GetConversation() != "":
		text = m.GetConversation()
	case m.GetExtendedTextMessage() != nil:
		text, context = m.GetExtendedTextMessage().GetText(), m.GetExtendedTextMessage().GetContextInfo()
	case m.GetImageMessage() != nil:
		text, media, context = m.GetImageMessage().GetCaption(), domain.MediaImage, m.GetImageMessage().GetContextInfo()
	case m.GetVideoMessage() != nil:
		text, media, context = m.GetVideoMessage().GetCaption(), domain.MediaVideo, m.GetVideoMessage().GetContextInfo()
	case m.GetAudioMessage() != nil:
		media, context = domain.MediaAudio, m.GetAudioMessage().GetContextInfo()
	case m.GetDocumentMessage() != nil:
		doc := m.GetDocumentMessage()
		text, media, context = doc.GetCaption(), domain.MediaDocument, doc.GetContextInfo()
		if text == "" {
			text = doc.GetFileName()
		}
	case m.GetStickerMessage() != nil:
		media, context = domain.MediaSticker, m.GetStickerMessage().GetContextInfo()
	case m.GetContactMessage() != nil:
		text, media, context = m.GetContactMessage().GetDisplayName(), domain.MediaContact, m.GetContactMessage().GetContextInfo()
	case m.GetLocationMessage() != nil:
		loc := m.GetLocationMessage()
		text, media, context = loc.GetName(), domain.MediaLocation, loc.GetContextInfo()
	}
	return text, media, context.GetStanzaID()
}

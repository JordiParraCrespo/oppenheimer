package whatsmeow

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.mau.fi/whatsmeow"
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
	lids lidMap
	// self is this device's own number and `@lid` id, when paired: a group
	// mentions the number, and quotes it, by either.
	self   selfIDs
	logger *slog.Logger
}

// selfIDs is the paired number's phone-number JID and its `@lid` id.
type selfIDs struct {
	phone, lid types.JID
}

// phoneFor is the paired number's phone-number JID when lid is its own
// `@lid` id: a mapping known without asking the device's LID store, which
// may not hold the number's own.
func (s selfIDs) phoneFor(lid types.JID) (types.JID, bool) {
	if s.lid.User == "" || s.phone.User == "" || lid.User != s.lid.User {
		return types.EmptyJID, false
	}
	return s.phone.ToNonAD(), true
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
	var ctxInfo *waE2E.ContextInfo
	r.Text, r.Media, ctxInfo = content(evt.Message)
	r.QuotedID = ctxInfo.GetStanzaID()
	if r.QuotedID != "" && ctxInfo.GetParticipant() != "" {
		r.QuotedSenderID = rd.idOf(ctx, ctxInfo.GetParticipant())
	}
	for _, mentioned := range ctxInfo.GetMentionedJID() {
		if id := rd.idOf(ctx, mentioned); id != "" {
			r.Mentions = append(r.Mentions, id)
		}
	}
	r.Kept = keptOf(evt.Message, rd.logger)
	return r
}

// keptOf is what fetching a message's audio (a voice note or an audio file)
// or image later takes, when it carries one: the AudioMessage or
// ImageMessage itself, serialized, which holds its media key and path.
func keptOf(m *waE2E.Message, logger *slog.Logger) *domain.Kept {
	var media proto.Message
	kept := domain.Kept{}
	switch {
	case m.GetAudioMessage() != nil:
		audio := m.GetAudioMessage()
		media, kept.Kind, kept.Seconds, kept.Size = audio, domain.KeptVoice, int(audio.GetSeconds()), audio.GetFileLength()
	case m.GetImageMessage() != nil:
		img := m.GetImageMessage()
		media, kept.Kind, kept.Size = img, domain.KeptImage, img.GetFileLength()
	default:
		return nil
	}
	ref, err := proto.Marshal(media)
	if err != nil {
		if logger != nil {
			logger.Warn("whatsapp: media could not be kept for fetching", slog.String("kind", string(kept.Kind)), slog.Any("error", err))
		}
		return nil
	}
	kept.Ref = ref
	return &kept
}

// downloadableOf reads back the message keptOf kept for kind, and what
// WhatsApp says of it: its MIME type and length.
func downloadableOf(kind domain.KeptKind, ref []byte) (whatsmeow.DownloadableMessage, string, uint64, error) {
	switch kind {
	case domain.KeptVoice:
		var audio waE2E.AudioMessage
		if err := proto.Unmarshal(ref, &audio); err != nil {
			return nil, "", 0, fmt.Errorf("a kept voice note is unreadable: %w", err)
		}
		return &audio, audio.GetMimetype(), audio.GetFileLength(), nil
	case domain.KeptImage:
		var img waE2E.ImageMessage
		if err := proto.Unmarshal(ref, &img); err != nil {
			return nil, "", 0, fmt.Errorf("a kept image is unreadable: %w", err)
		}
		return &img, img.GetMimetype(), img.GetFileLength(), nil
	}
	return nil, "", 0, fmt.Errorf("no kept media of kind %q", kind)
}

// idOf reads a JID WhatsApp wrote as text (a mention, a quoted message's
// sender) and names it the way senders are named: by phone number when it is
// known. Empty when it is not a JID.
func (rd reader) idOf(ctx context.Context, raw string) string {
	who, err := types.ParseJID(raw)
	if err != nil || who.User == "" {
		return ""
	}
	return rd.phoneOf(ctx, who, types.EmptyJID).String()
}

// phoneOf is who as a phone-number JID when it is a `@lid` id and its number
// is known: alt when WhatsApp gave it, the paired number's own (selfIDs),
// else the device's LID map. The owner
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
	if pn, ok := rd.self.phoneFor(who); ok {
		return pn
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

// outgoingVoice is the message a voice note uploaded to WhatsApp goes as:
// an audio message marked push-to-talk, with the upload's keys and hashes, in
// the one MIME type WhatsApp plays as a voice note, and its waveform, without
// which the phones do not play it as one.
func outgoingVoice(up whatsmeow.UploadResponse, seconds int, waveform []byte, at time.Time) *waE2E.Message {
	// The service allows 1 to domain.VoiceSendMaxSeconds; anything else shows no length.
	var length uint32
	if seconds > 0 && seconds <= domain.VoiceSendMaxSeconds {
		length = uint32(seconds)
	}
	return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
		URL:               proto.String(up.URL),
		DirectPath:        proto.String(up.DirectPath),
		MediaKey:          up.MediaKey,
		FileEncSHA256:     up.FileEncSHA256,
		FileSHA256:        up.FileSHA256,
		FileLength:        proto.Uint64(up.FileLength),
		Mimetype:          proto.String(domain.VoiceNoteMimetype),
		Seconds:           proto.Uint32(length),
		PTT:               proto.Bool(true),
		Waveform:          waveform,
		MediaKeyTimestamp: proto.Int64(at.Unix()),
	}}
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
// kind, and its context: the message it quotes and whom it mentions. Reactions, edits, polls and
// protocol messages carry neither text nor media here, and are not read yet.
func content(m *waE2E.Message) (text, media string, ctxInfo *waE2E.ContextInfo) {
	if m == nil {
		return "", "", nil
	}
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
	return text, media, ctxInfo
}

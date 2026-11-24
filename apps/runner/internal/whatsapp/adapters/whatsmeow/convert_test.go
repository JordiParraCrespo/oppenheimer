package whatsmeow

import (
	"context"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

type fixedNames map[string]string

func (f fixedNames) chatName(chat types.JID) string { return f[chat.ToNonAD().String()] }

// fixedLIDs is a LID map: the phone number behind each `@lid` user it knows.
type fixedLIDs map[string]types.JID

func (f fixedLIDs) GetPNForLID(_ context.Context, lid types.JID) (types.JID, error) {
	return f[lid.User], nil
}

func read(m *events.Message, n names, lids lidMap) domain.Received {
	return reader{names: n, lids: lids}.received(context.Background(), m)
}

var (
	marta = types.NewJID("34600333444", types.DefaultUserServer)
	group = types.NewJID("120363000000000000", types.GroupServer)
	at    = time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)
)

func evt(chat, sender types.JID, m *waE2E.Message) *events.Message {
	return &events.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{Chat: chat, Sender: sender, IsGroup: chat.Server == types.GroupServer},
			ID:            "3EB0A1", PushName: "Marta", Timestamp: at,
		},
		Message: m,
	}
}

// A direct text, a group caption with a quote, and a document with no
// caption each read the way the control plane names them.
func TestReceivedReadsTextCaptionsQuotesAndMedia(t *testing.T) {
	names := fixedNames{group.String(): "Family"}

	direct := read(evt(marta, marta, &waE2E.Message{Conversation: proto.String("hola")}), names, nil)
	if direct.Where != domain.WhereChat || direct.ChatKind != domain.ChatDirect || direct.Text != "hola" ||
		direct.ChatName != "Marta" || direct.SenderID != "34600333444@s.whatsapp.net" || !direct.SentAt.Equal(at) {
		t.Fatalf("direct: %+v", direct)
	}

	photo := read(evt(group, marta, &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
		Caption:     proto.String("look"),
		ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String("3EB0A0")},
	}}), names, nil)
	if photo.ChatKind != domain.ChatGroup || photo.ChatName != "Family" || photo.Media != domain.MediaImage ||
		photo.Text != "look" || photo.QuotedID != "3EB0A0" {
		t.Fatalf("group photo: %+v", photo)
	}

	doc := read(evt(marta, marta, &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{FileName: proto.String("invoice.pdf")}}), names, nil)
	if doc.Media != domain.MediaDocument || doc.Text != "invoice.pdf" {
		t.Fatalf("document: %+v", doc)
	}
}

// Status updates, broadcast lists and newsletters are told apart, so the
// domain can drop them.
func TestReceivedNamesWhereItWasSent(t *testing.T) {
	text := &waE2E.Message{Conversation: proto.String("x")}
	for want, chat := range map[domain.Where]types.JID{
		domain.WhereStatus:     types.StatusBroadcastJID,
		domain.WhereBroadcast:  types.NewJID("1234", types.BroadcastServer),
		domain.WhereNewsletter: types.NewJID("1203", types.NewsletterServer),
	} {
		if got := read(evt(chat, marta, text), nil, nil).Where; got != want {
			t.Errorf("%s: %s, want %s", chat, got, want)
		}
	}
}

// Under LID addressing the sender is a `@lid` id; its phone number, when
// WhatsApp gives it, is the one handed on.
func TestReceivedPrefersThePhoneNumberOverALID(t *testing.T) {
	m := evt(group, types.NewJID("98765", types.HiddenUserServer), &waE2E.Message{Conversation: proto.String("x")})
	m.Info.SenderAlt = marta
	if got := read(m, nil, nil).SenderID; got != "34600333444@s.whatsapp.net" {
		t.Fatalf("sender %s", got)
	}
}

// A `@lid` sender that comes without its number is looked up in the
// device's LID map: the owner, named by phone number, is recognised however
// WhatsApp addressed them. One whose number is not known yet keeps its `@lid`.
// Lost, the confirmed owner would be ignored without a word.
func TestReceivedLooksUpTheNumberBehindALIDSender(t *testing.T) {
	lids := fixedLIDs{"98765": marta}
	known := evt(group, types.NewJID("98765", types.HiddenUserServer), &waE2E.Message{Conversation: proto.String("x")})
	if got := read(known, nil, lids).SenderID; got != "34600333444@s.whatsapp.net" {
		t.Fatalf("known sender %s", got)
	}
	unknown := evt(group, types.NewJID("11111", types.HiddenUserServer), &waE2E.Message{Conversation: proto.String("x")})
	if got := read(unknown, nil, lids).SenderID; got != "11111@lid" {
		t.Fatalf("unknown sender %s", got)
	}
}

// A direct chat that arrives as `@lid` is reported by phone number, the
// owner's and this number's own messages alike, so one person keeps one chat.
// Split, the owner's conversation would start over whenever WhatsApp
// switched addressing.
func TestReceivedReportsADirectLIDChatByNumber(t *testing.T) {
	lid := types.NewJID("98765", types.HiddenUserServer)
	text := &waE2E.Message{Conversation: proto.String("x")}

	fromThem := read(evt(lid, lid, text), nil, fixedLIDs{"98765": marta})
	if fromThem.ChatID != "34600333444@s.whatsapp.net" || fromThem.SenderID != "34600333444@s.whatsapp.net" {
		t.Fatalf("their message: chat %s sender %s", fromThem.ChatID, fromThem.SenderID)
	}

	me := types.NewJID("34600111222", types.DefaultUserServer)
	mine := evt(lid, me, text)
	mine.Info.IsFromMe = true
	mine.Info.RecipientAlt = marta
	if got := read(mine, nil, nil).ChatID; got != "34600333444@s.whatsapp.net" {
		t.Fatalf("this number's message: chat %s", got)
	}
}

// A reply with a quote is an extended text naming the quoted message and its
// sender, so WhatsApp shows it under the owner's message; one without is
// plain text. Wrong, the reply goes out unquoted, or malformed.
func TestOutgoingQuotesTheMessageRepliedTo(t *testing.T) {
	quoted := outgoing("Sold 3.", &domain.Quote{ID: "3EB0A1", SenderID: "34600333444@s.whatsapp.net"})
	ext := quoted.GetExtendedTextMessage()
	if quoted.Conversation != nil || ext.GetText() != "Sold 3." ||
		ext.GetContextInfo().GetStanzaID() != "3EB0A1" ||
		ext.GetContextInfo().GetParticipant() != "34600333444@s.whatsapp.net" ||
		ext.GetContextInfo().GetQuotedMessage() == nil {
		t.Fatalf("quoted: %v", quoted)
	}

	plain := outgoing("Sold 3.", nil)
	if plain.GetConversation() != "Sold 3." || plain.ExtendedTextMessage != nil {
		t.Fatalf("plain: %v", plain)
	}
}

// A voice note and an image read with what fetching them later takes: the
// AudioMessage or ImageMessage itself, which downloadableOf reads back with
// its media key and path, as the kind it was kept as. A text carries none.
// Breaks if an image is kept as audio (WhatsApp refuses the download) or
// either loses its key.
func TestReceivedKeepsVoiceNotesAndImagesForFetching(t *testing.T) {
	note := read(evt(marta, marta, &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
		PTT: proto.Bool(true), Seconds: proto.Uint32(12), FileLength: proto.Uint64(20480),
		Mimetype: proto.String("audio/ogg; codecs=opus"), DirectPath: proto.String("/v/t62.7117-24/1"),
		MediaKey: []byte{7, 7, 7},
	}}), nil, nil)
	if note.Media != domain.MediaAudio || note.Kept == nil || note.Kept.Kind != domain.KeptVoice ||
		note.Kept.Seconds != 12 || note.Kept.Size != 20480 {
		t.Fatalf("voice note: %+v", note)
	}
	audio, mimetype, length, err := downloadableOf(domain.KeptVoice, note.Kept.Ref)
	if err != nil || mimetype != "audio/ogg; codecs=opus" || length != 20480 ||
		string(audio.GetMediaKey()) != "\x07\x07\x07" || audio.GetDirectPath() != "/v/t62.7117-24/1" {
		t.Fatalf("read back %v %q %d %v", audio, mimetype, length, err)
	}

	photo := read(evt(marta, marta, &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
		Caption: proto.String("look"), FileLength: proto.Uint64(90000), Mimetype: proto.String("image/jpeg"),
		DirectPath: proto.String("/v/t62.7118-24/2"), MediaKey: []byte{9},
	}}), nil, nil)
	if photo.Media != domain.MediaImage || photo.Text != "look" || photo.Kept == nil ||
		photo.Kept.Kind != domain.KeptImage || photo.Kept.Size != 90000 {
		t.Fatalf("image: %+v", photo)
	}
	img, mimetype, _, err := downloadableOf(domain.KeptImage, photo.Kept.Ref)
	if err != nil || mimetype != "image/jpeg" || img.GetDirectPath() != "/v/t62.7118-24/2" {
		t.Fatalf("read back %v %q %v", img, mimetype, err)
	}

	if text := read(evt(marta, marta, &waE2E.Message{Conversation: proto.String("hola")}), nil, nil); text.Kept != nil {
		t.Fatalf("a text carries media: %+v", text.Kept)
	}
}

// A group message reports whom it mentions and whose message it quotes, by
// phone number however WhatsApp addressed them: the number's own `@lid` id
// included, which the device knows without its LID map. Lost, a mention of
// the number in a LID-addressed group would never wake its bot.
func TestReceivedReportsMentionsAndTheQuotedSenderByNumber(t *testing.T) {
	self := types.NewJID("34600111222", types.DefaultUserServer)
	selfLID := types.NewJID("55555", types.HiddenUserServer)
	rd := reader{lids: fixedLIDs{"98765": marta}, self: selfIDs{phone: self, lid: selfLID}}
	m := evt(group, marta, &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
		Text: proto.String("@55555 @98765 what do you think?"),
		ContextInfo: &waE2E.ContextInfo{
			StanzaID:     proto.String("3EB0A0"),
			Participant:  proto.String("55555@lid"),
			MentionedJID: []string{"55555@lid", "98765@lid", "not a jid@"},
		},
	}})
	got := rd.received(context.Background(), m)
	if got.QuotedID != "3EB0A0" || got.QuotedSenderID != "34600111222@s.whatsapp.net" {
		t.Fatalf("quote: %q by %q", got.QuotedID, got.QuotedSenderID)
	}
	if len(got.Mentions) != 2 || got.Mentions[0] != "34600111222@s.whatsapp.net" || got.Mentions[1] != "34600333444@s.whatsapp.net" {
		t.Fatalf("mentions: %v", got.Mentions)
	}

	plain := rd.received(context.Background(), evt(group, marta, &waE2E.Message{Conversation: proto.String("hola")}))
	if plain.QuotedSenderID != "" || plain.Mentions != nil {
		t.Fatalf("a plain message reported %q, %v", plain.QuotedSenderID, plain.Mentions)
	}
}

// A voice note goes as push-to-talk Ogg/Opus with the upload's keys, which is
// what makes the phone draw a playable voice note: without PTT it shows as an
// audio file, and without the keys and path the recipient cannot fetch it.
func TestOutgoingVoiceIsAPlayableVoiceNote(t *testing.T) {
	at := time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)
	m := outgoingVoice(whatsmeow.UploadResponse{
		URL: "https://mmg.whatsapp.net/v/1", DirectPath: "/v/1", MediaKey: []byte{1},
		FileEncSHA256: []byte{2}, FileSHA256: []byte{3}, FileLength: 2048,
	}, 4, []byte{0, 50, 100}, at).GetAudioMessage()
	if !m.GetPTT() || m.GetMimetype() != "audio/ogg; codecs=opus" || m.GetSeconds() != 4 ||
		m.GetDirectPath() != "/v/1" || m.GetURL() != "https://mmg.whatsapp.net/v/1" ||
		string(m.GetMediaKey()) != "\x01" || string(m.GetFileEncSHA256()) != "\x02" ||
		string(m.GetFileSHA256()) != "\x03" || m.GetFileLength() != 2048 ||
		m.GetMediaKeyTimestamp() != at.Unix() || string(m.GetWaveform()) != "\x00\x32\x64" {
		t.Fatalf("voice note: %v", m)
	}
}

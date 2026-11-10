package whatsmeow

import (
	"context"
	"testing"
	"time"

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

package whatsmeow

import (
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

	direct := received(evt(marta, marta, &waE2E.Message{Conversation: proto.String("hola")}), names)
	if direct.Where != domain.WhereChat || direct.ChatKind != domain.ChatDirect || direct.Text != "hola" ||
		direct.ChatName != "Marta" || direct.SenderID != "34600333444@s.whatsapp.net" || !direct.SentAt.Equal(at) {
		t.Fatalf("direct: %+v", direct)
	}

	photo := received(evt(group, marta, &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
		Caption:     proto.String("look"),
		ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String("3EB0A0")},
	}}), names)
	if photo.ChatKind != domain.ChatGroup || photo.ChatName != "Family" || photo.Media != domain.MediaImage ||
		photo.Text != "look" || photo.QuotedID != "3EB0A0" {
		t.Fatalf("group photo: %+v", photo)
	}

	doc := received(evt(marta, marta, &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{FileName: proto.String("invoice.pdf")}}), names)
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
		if got := received(evt(chat, marta, text), nil).Where; got != want {
			t.Errorf("%s: %s, want %s", chat, got, want)
		}
	}
}

// Under LID addressing the sender is a `@lid` id; its phone number, when
// WhatsApp gives it, is the one handed on.
func TestReceivedPrefersThePhoneNumberOverALID(t *testing.T) {
	m := evt(group, types.NewJID("98765", types.HiddenUserServer), &waE2E.Message{Conversation: proto.String("x")})
	m.Info.SenderAlt = marta
	if got := received(m, nil).SenderID; got != "34600333444@s.whatsapp.net" {
		t.Fatalf("sender %s", got)
	}
}

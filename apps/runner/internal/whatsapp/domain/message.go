package domain

import (
	"encoding/json"
	"strings"
	"time"
)

// TextMaxChars is the longest text one message carries on the link
// (`WHATSAPP_TEXT_MAX_CHARS`); a longer one is cut here, with CutMark.
const TextMaxChars = 8000

// CutMark ends a text that was cut to TextMaxChars.
const CutMark = " […cut]"

// OutboxMax is how many messages the host keeps waiting for the control
// plane at most. A host offline from its control plane for days keeps the
// newest; past this the oldest go, with a warning.
const OutboxMax = 10_000

// MaxAge is how old a message may be when it arrives and still be handed on.
// WhatsApp delivers what queued while the device was offline; a bot that
// answered a day-old message would answer a conversation that has moved on,
// and replying to old messages is one of the patterns OpenClaw avoids to keep
// a number from being banned.
const MaxAge = 10 * time.Minute

// ChatKind is a direct chat or a group.
type ChatKind string

const (
	ChatDirect ChatKind = "direct"
	ChatGroup  ChatKind = "group"
)

// Where a message was sent, as the adapter reads it off WhatsApp: the kinds of
// chat this context drops never become an Inbound.
type Where string

const (
	WhereChat Where = "chat"
	// WhereStatus is a status update (`status@broadcast`): nobody wrote to the owner.
	WhereStatus Where = "status"
	// WhereBroadcast is a broadcast list's copy, or the owner's own broadcast.
	WhereBroadcast Where = "broadcast"
	// WhereNewsletter is a channel the owner follows.
	WhereNewsletter Where = "newsletter"
)

// Media kinds, as `whatsapp.messages` names them. Only the kind travels: the
// media itself stays on the phone.
const (
	MediaImage    = "image"
	MediaVideo    = "video"
	MediaAudio    = "audio"
	MediaDocument = "document"
	MediaSticker  = "sticker"
	MediaContact  = "contact"
	MediaLocation = "location"
)

// Received is a message as the adapter read it, before this context decides
// whether it is one to hand on.
type Received struct {
	Where      Where
	ID         string
	ChatID     string
	ChatKind   ChatKind
	ChatName   string
	SenderID   string
	SenderName string
	FromMe     bool
	Text       string
	Media      string
	QuotedID   string
	SentAt     time.Time
}

// Inbound is a message the control plane is handed and keeps.
type Inbound struct {
	// Key is the outbox's key for it, which `whatsapp.ack` names: the chat
	// and the message id, since WhatsApp's ids are unique within a chat.
	Key        string
	ID         string
	ChatID     string
	ChatKind   ChatKind
	ChatName   string
	SenderID   string
	SenderName string
	FromMe     bool
	Text       string
	Media      string
	QuotedID   string
	SentAt     time.Time
}

// KeyOf is a message's outbox key.
func KeyOf(chatID, id string) string { return chatID + "/" + id }

// Admit decides whether a received message is handed on, and in what shape.
// Status updates, broadcast lists and newsletters are dropped: nobody wrote
// to the owner there. So is anything with neither text nor media (a
// reaction, an edit, a protocol message: not read yet), anything sent before
// the device was paired (no history), and anything older than MaxAge.
func Admit(r Received, now, pairedAt time.Time) (Inbound, bool) {
	if r.Where != WhereChat || r.ID == "" || r.ChatID == "" || r.SenderID == "" {
		return Inbound{}, false
	}
	if r.Text == "" && r.Media == "" {
		return Inbound{}, false
	}
	if !pairedAt.IsZero() && r.SentAt.Before(pairedAt) {
		return Inbound{}, false
	}
	if now.Sub(r.SentAt) > MaxAge {
		return Inbound{}, false
	}
	kind := r.ChatKind
	if kind != ChatGroup {
		kind = ChatDirect
	}
	return Inbound{
		Key: KeyOf(r.ChatID, r.ID), ID: r.ID,
		ChatID: r.ChatID, ChatKind: kind, ChatName: r.ChatName,
		SenderID: r.SenderID, SenderName: r.SenderName, FromMe: r.FromMe,
		Text: CutText(r.Text), Media: r.Media, QuotedID: r.QuotedID,
		SentAt: r.SentAt.UTC(),
	}, true
}

// CutText fits a text to TextMaxChars, ending a cut one with CutMark.
// Characters are counted the way the control plane's schema counts them, in
// UTF-16 code units (a JavaScript string's length), so an emoji is two and a
// cut text is never refused there. Invalid UTF-8 is replaced first, and a cut
// never splits a character.
func CutText(text string) string {
	text = strings.ToValidUTF8(text, "\uFFFD")
	if utf16Len(text) <= TextMaxChars {
		return text
	}
	return Fit(text, TextMaxChars-utf16Len(CutMark)) + CutMark
}

// Fit cuts s to at most n UTF-16 code units, on a character boundary.
func Fit(s string, n int) string {
	units := 0
	for i, r := range s {
		width := 1
		if r >= 0x10000 {
			width = 2
		}
		if units+width > n {
			return s[:i]
		}
		units += width
	}
	return s
}

func utf16Len(s string) int {
	units := 0
	for _, r := range s {
		units++
		if r >= 0x10000 {
			units++
		}
	}
	return units
}

// BatchMaxBytes bounds one batch's messages as JSON, well under the link's
// frame cap (`LINK_MAX_FRAME_BYTES`, 512 KiB): 50 messages of 8,000
// characters each can pass a megabyte, and a frame the link refuses would be
// offered again forever, holding every newer message behind it.
const BatchMaxBytes = 384 * 1024

// Batches splits messages, in order, into batches of at most maxCount whose
// JSON stays under maxBytes. One message larger than maxBytes on its own
// (which the length cuts make impossible) still goes, alone.
func Batches(messages []Inbound, maxCount, maxBytes int) [][]Inbound {
	var batches [][]Inbound
	var current []Inbound
	size := 0
	for _, message := range messages {
		encoded := encodedSize(message)
		if len(current) > 0 && (len(current) == maxCount || size+encoded > maxBytes) {
			batches = append(batches, current)
			current, size = nil, 0
		}
		current = append(current, message)
		size += encoded
	}
	if len(current) > 0 {
		batches = append(batches, current)
	}
	return batches
}

// encodedSize is the message's JSON length, field names included, which
// tracks the wire's within a few bytes and counts escapes as they go.
func encodedSize(message Inbound) int {
	encoded, err := json.Marshal(message)
	if err != nil {
		return len(message.Text)*6 + 1024
	}
	return len(encoded)
}

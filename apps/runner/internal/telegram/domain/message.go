package domain

import (
	"encoding/json"
	"strings"
	"time"
)

// TextMaxChars is the longest text one message carries
// (`TELEGRAM_TEXT_MAX_CHARS`, the Bot API's own limit); a longer caption is
// cut here, with CutMark.
const TextMaxChars = 4096

// CutMark ends a text that was cut to TextMaxChars.
const CutMark = " […cut]"

// OutboxMax is how many messages the host keeps waiting for the control
// plane at most; past it the oldest go, with a warning.
const OutboxMax = 10_000

// MaxAge is how old a message may be on the first poll after a bot is
// connected and still be handed on. Telegram keeps a bot's updates for a
// day; a token that was polled somewhere else before brings that backlog,
// and a bot answering it would answer conversations that moved on. A host
// resuming its own stored offset hands on everything: those it missed.
const MaxAge = 10 * time.Minute

// ChatKind is a direct chat or a group.
type ChatKind string

const (
	ChatDirect ChatKind = "direct"
	ChatGroup  ChatKind = "group"
)

// Telegram's chat types, as an update names them.
const (
	TypePrivate    = "private"
	TypeGroup      = "group"
	TypeSupergroup = "supergroup"
	TypeChannel    = "channel"
)

// Media kinds, as `telegram.messages` names them. Only the kind travels.
const (
	MediaPhoto     = "photo"
	MediaVideo     = "video"
	MediaAudio     = "audio"
	MediaVoice     = "voice"
	MediaDocument  = "document"
	MediaSticker   = "sticker"
	MediaAnimation = "animation"
	MediaContact   = "contact"
	MediaLocation  = "location"
	MediaPoll      = "poll"
)

// Received is a message as the adapter read it off an update, before this
// context decides whether it is one to hand on.
type Received struct {
	// UpdateID is the update's id: the poll's offset moves past it whatever
	// this context decides.
	UpdateID int64
	// IsMessage is false for every update that is not a new message: edits,
	// channel posts, reactions, joins.
	IsMessage      bool
	ID             string
	ChatID         string
	ChatType       string
	ChatName       string
	SenderID       string
	SenderName     string
	SenderUsername string
	Text           string
	Media          string
	ReplyToID      string
	SentAt         time.Time
}

// Inbound is a message the control plane is handed and keeps.
type Inbound struct {
	// Key is the outbox's key for it, which `telegram.ack` names: the chat
	// and the message id, since Telegram's ids are unique within a chat.
	Key            string
	ID             string
	ChatID         string
	ChatKind       ChatKind
	ChatName       string
	SenderID       string
	SenderName     string
	SenderUsername string
	Text           string
	Media          string
	ReplyToID      string
	SentAt         time.Time
}

// KeyOf is a message's outbox key.
func KeyOf(chatID, id string) string { return chatID + "/" + id }

// Admit decides whether a received update is handed on, and in what shape.
// Anything that is not a new message is dropped, and so are channel posts,
// service messages (no text and no media: a join, a pin) and, when fresh is
// set, anything older than MaxAge.
func Admit(r Received, now time.Time, fresh bool) (Inbound, bool) {
	if !r.IsMessage || r.ID == "" || r.ChatID == "" || r.SenderID == "" {
		return Inbound{}, false
	}
	var kind ChatKind
	switch r.ChatType {
	case TypePrivate:
		kind = ChatDirect
	case TypeGroup, TypeSupergroup:
		kind = ChatGroup
	default:
		return Inbound{}, false
	}
	if r.Text == "" && r.Media == "" {
		return Inbound{}, false
	}
	if fresh && now.Sub(r.SentAt) > MaxAge {
		return Inbound{}, false
	}
	return Inbound{
		Key: KeyOf(r.ChatID, r.ID), ID: r.ID,
		ChatID: r.ChatID, ChatKind: kind, ChatName: Fit(r.ChatName, 200),
		SenderID: r.SenderID, SenderName: Fit(r.SenderName, 200), SenderUsername: Fit(r.SenderUsername, 64),
		Text: CutText(r.Text), Media: r.Media, ReplyToID: r.ReplyToID,
		SentAt: r.SentAt.UTC(),
	}, true
}

// IsGroupChat reports whether a chat id is a group's: Telegram gives groups
// and supergroups negative ids, people positive ones.
func IsGroupChat(chatID string) bool { return strings.HasPrefix(chatID, "-") }

// CutText fits a text to TextMaxChars, ending a cut one with CutMark.
// Characters are counted the way the control plane's schema counts them, in
// UTF-16 code units, so a cut text is never refused there.
func CutText(text string) string {
	text = strings.ToValidUTF8(text, "�")
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
// frame cap (`LINK_MAX_FRAME_BYTES`, 512 KiB).
const BatchMaxBytes = 384 * 1024

// Batches splits messages, in order, into batches of at most maxCount whose
// JSON stays under maxBytes. One message larger than maxBytes still goes, alone.
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

func encodedSize(message Inbound) int {
	encoded, err := json.Marshal(message)
	if err != nil {
		return len(message.Text)*6 + 1024
	}
	return len(encoded)
}

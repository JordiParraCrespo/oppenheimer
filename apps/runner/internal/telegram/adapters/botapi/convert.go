package botapi

import (
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// update is the part of a Bot API Update this runner reads. Only `message`
// is asked for; anything else that comes is not a message.
type update struct {
	UpdateID int64    `json:"update_id"`
	Message  *message `json:"message"`
}

type chat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type message struct {
	MessageID int64    `json:"message_id"`
	Date      int64    `json:"date"`
	Chat      chat     `json:"chat"`
	From      *user    `json:"from"`
	Text      string   `json:"text"`
	Caption   string   `json:"caption"`
	ReplyTo   *message `json:"reply_to_message"`

	Photo     []struct{} `json:"photo"`
	Video     *struct{}  `json:"video"`
	VideoNote *struct{}  `json:"video_note"`
	Audio     *struct{}  `json:"audio"`
	Voice     *struct{}  `json:"voice"`
	Document  *struct{}  `json:"document"`
	Sticker   *struct{}  `json:"sticker"`
	Animation *struct{}  `json:"animation"`
	Contact   *struct{}  `json:"contact"`
	Location  *struct{}  `json:"location"`
	Venue     *struct{}  `json:"venue"`
	Poll      *struct{}  `json:"poll"`
}

// media is the message's kind of media, or empty. An animation also carries
// a document, so it is asked first; a venue carries a location.
func (m *message) media() string {
	switch {
	case m.Animation != nil:
		return domain.MediaAnimation
	case len(m.Photo) > 0:
		return domain.MediaPhoto
	case m.Video != nil, m.VideoNote != nil:
		return domain.MediaVideo
	case m.Voice != nil:
		return domain.MediaVoice
	case m.Audio != nil:
		return domain.MediaAudio
	case m.Document != nil:
		return domain.MediaDocument
	case m.Sticker != nil:
		return domain.MediaSticker
	case m.Contact != nil:
		return domain.MediaContact
	case m.Location != nil, m.Venue != nil:
		return domain.MediaLocation
	case m.Poll != nil:
		return domain.MediaPoll
	}
	return ""
}

// received reads an update into the domain's shape.
func (u update) received() app.Update {
	r := app.Update{UpdateID: u.UpdateID}
	m := u.Message
	if m == nil {
		return r
	}
	r.IsMessage = true
	r.ID = strconv.FormatInt(m.MessageID, 10)
	r.ChatID = strconv.FormatInt(m.Chat.ID, 10)
	r.ChatType = m.Chat.Type
	r.ChatName = m.Chat.Title
	if r.ChatName == "" {
		r.ChatName = strings.TrimSpace(m.Chat.FirstName + " " + m.Chat.LastName)
	}
	if m.From != nil {
		r.SenderID = strconv.FormatInt(m.From.ID, 10)
		r.SenderName = m.From.name()
		r.SenderUsername = m.From.Username
	}
	r.Text = m.Text
	if r.Text == "" {
		r.Text = m.Caption
	}
	r.Media = m.media()
	if m.ReplyTo != nil {
		r.ReplyToID = strconv.FormatInt(m.ReplyTo.MessageID, 10)
	}
	r.SentAt = time.Unix(m.Date, 0).UTC()
	return r
}

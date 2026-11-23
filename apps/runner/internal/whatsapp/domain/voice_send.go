package domain

import (
	"bytes"
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// VoiceNoteMimetype is the one MIME type WhatsApp plays as a voice note: Ogg
// holding Opus. Anything else sent as push-to-talk shows as a broken note.
const VoiceNoteMimetype = "audio/ogg; codecs=opus"

// VoiceSendMaxSeconds is the longest voice note the control plane sends
// (WHATSAPP_VOICE_SEND_MAX_SECONDS on the link).
const VoiceSendMaxSeconds = 120

// ErrNotVoiceNote refuses audio WhatsApp would not play as a voice note.
var ErrNotVoiceNote = problem.New("WA_008", http.StatusUnsupportedMediaType, "That audio is not a voice note WhatsApp can play")

// CheckVoiceOut is why a voice note to send cannot go, before any of it is
// uploaded: empty, larger than a frame carries (WA_006), not Ogg/Opus,
// running a length the link does not allow, or silent from end to end
// (WA_008), which would otherwise go as a note of the right length that
// plays nothing. Nil when it can go.
func CheckVoiceOut(audio []byte, seconds int) error {
	if len(audio) > VoiceNoteMaxBytes {
		return ErrVoiceTooLarge.WithDetail("%d bytes, at most %d", len(audio), VoiceNoteMaxBytes)
	}
	if !isOggOpus(audio) {
		return ErrNotVoiceNote.WithDetail("it is not Ogg/Opus audio")
	}
	if seconds < 1 || seconds > VoiceSendMaxSeconds {
		return ErrNotVoiceNote.WithDetail("it runs %d seconds; a voice note sent here runs 1 to %d", seconds, VoiceSendMaxSeconds)
	}
	if isSilent(audio) {
		return ErrNotVoiceNote.WithDetail("it is silent from start to end")
	}
	return nil
}

// isOggOpus reads the first Ogg page: its capture pattern, and the Opus
// identification header it must carry.
func isOggOpus(audio []byte) bool {
	if len(audio) < 27 || !bytes.Equal(audio[:4], []byte("OggS")) {
		return false
	}
	segments := int(audio[26])
	start := 27 + segments
	return len(audio) >= start+8 && bytes.Equal(audio[start:start+8], []byte("OpusHead"))
}

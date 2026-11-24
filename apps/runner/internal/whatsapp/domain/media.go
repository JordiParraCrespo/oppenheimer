package domain

import "errors"

// KeptKind is a kind of media the control plane can ask for after the
// message went out (`whatsapp.media.get`): a voice note to hear, or an image
// to see. Each is kept and fetched the same way; only its caps and what is
// done with the bytes differ.
type KeptKind string

const (
	KeptVoice KeptKind = "voice"
	KeptImage KeptKind = "image"
)

// DownloadMax is the most a kind downloads from WhatsApp: a voice note must
// fit one frame as it is, an image is scaled down to fit one (FitImage).
func (k KeptKind) DownloadMax() int {
	if k == KeptImage {
		return ImageDownloadMaxBytes
	}
	return VoiceNoteMaxBytes
}

// DefaultMimetype is what a download WhatsApp gave no type for is sent as.
func (k KeptKind) DefaultMimetype() string {
	if k == KeptImage {
		return ImageMimetype
	}
	return VoiceNoteMimetype
}

// ErrMediaPastFrame is media that does not fit one link frame.
var ErrMediaPastFrame = errors.New("larger than one frame carries")

// Fit is the downloaded media as it travels in one frame: a voice note as it
// is, or ErrMediaPastFrame; an image as FitImage makes it.
func (k KeptKind) Fit(data []byte, mimetype string) ([]byte, string, error) {
	if k == KeptImage {
		return FitImage(data, mimetype, ImageMaxBytes)
	}
	if len(data) > VoiceNoteMaxBytes {
		return nil, "", ErrMediaPastFrame
	}
	return data, mimetype, nil
}

// Kept is what fetching a voice note or an image later takes: its kind, the
// adapter's own reference to it (opaque here), how long a voice note runs,
// and how large WhatsApp says it is.
type Kept struct {
	Kind    KeptKind
	Ref     []byte
	Seconds int
	Size    uint64
}

// TooLarge reports whether it is past what its kind downloads at all.
func (k Kept) TooLarge() bool { return k.Size > uint64(k.Kind.DownloadMax()) } //nolint:gosec // a positive constant

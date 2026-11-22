package domain

import (
	"os"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// The fixtures are synthetic, made with libsndfile's Ogg/Opus writer: two
// seconds at 24 kHz mono (what OpenAI's `opus` answers), one a voiced tone
// under a syllable envelope, one digital silence. Both are whole Ogg/Opus
// with a two-second granule, so length and container alone cannot tell them
// apart. A third, made with ffmpeg's libopus, is a tone peaking at -20 dBFS
// in 2.5 ms frames at 12 kbit/s constant bitrate: every packet is 3 bytes,
// the size libopus codes a frame of silence in.
func fixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// A provider that answers silence still answers a note of the right length;
// it went to WhatsApp as a success and played nothing. It is refused before
// the upload, and speech is not.
func TestCheckVoiceOutRefusesSilence(t *testing.T) {
	if err := CheckVoiceOut(fixture(t, "silent-2s.ogg"), 2); problem.From(err) == nil || problem.From(err).Code != "WA_008" {
		t.Fatalf("silence went as a voice note: %v", err)
	}
	if err := CheckVoiceOut(fixture(t, "speech-like-2s.ogg"), 2); err != nil {
		t.Fatalf("speech was refused: %v", err)
	}
}

// Packet size follows frame length and bitrate as well as sound: audio in
// short frames has packets as small as silence however loud it is, and was
// refused as silence when the check read raw packet size.
func TestCheckVoiceOutDoesNotJudgeShortFramesSilent(t *testing.T) {
	tone := fixture(t, "tone-2.5ms-frames-12k-cbr-2s.ogg")
	if err := CheckVoiceOut(tone, 2); err != nil {
		t.Fatalf("a loud tone in short frames was refused: %v", err)
	}
	loud := 0
	for _, bar := range VoiceWaveform(tone) {
		if bar >= 30 {
			loud++
		}
	}
	if loud < VoiceWaveformBars/2 {
		t.Fatalf("a loud tone in short frames drew a flat waveform: %v", VoiceWaveform(tone))
	}
}

// The phones only play a push-to-talk note that carries its waveform: 64
// bars of 0 to 100, standing up where there is sound.
func TestVoiceWaveformFollowsTheSound(t *testing.T) {
	speech := VoiceWaveform(fixture(t, "speech-like-2s.ogg"))
	if len(speech) != VoiceWaveformBars {
		t.Fatalf("speech waveform: %d bars", len(speech))
	}
	loud := 0
	for _, bar := range speech {
		if bar > 100 {
			t.Fatalf("a bar past 100: %v", speech)
		}
		if bar >= 30 {
			loud++
		}
	}
	if loud < VoiceWaveformBars/2 {
		t.Fatalf("speech drew a flat waveform: %v", speech)
	}
	for _, bar := range VoiceWaveform(fixture(t, "silent-2s.ogg")) {
		if bar != 0 {
			t.Fatalf("silence drew a bar: %v", VoiceWaveform(fixture(t, "silent-2s.ogg")))
		}
	}
	if VoiceWaveform([]byte("not ogg")) != nil {
		t.Fatal("a waveform from no audio")
	}
}

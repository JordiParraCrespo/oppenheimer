package domain

// VoiceWaveformBars is how many bars a WhatsApp voice note's waveform holds,
// each 0 to 100, as the phone draws it.
const VoiceWaveformBars = 64

// silentPacketMaxBytes is the largest Opus packet that still only carries
// silence: libopus codes digital silence in 3 bytes, and speech, even at
// -45 dBFS, takes over 30.
const silentPacketMaxBytes = 8

// VoiceWaveform is the waveform a voice note sent as push-to-talk carries,
// drawn from the size of each Opus packet: no decoder runs on the host, and a
// variable-bitrate packet grows with what it carries, so silence is flat and
// speech stands up. The phones treat a note without one as no voice note
// (whatsmeow#517: it plays on the web, not on the phone). Nil when the audio
// holds no packets.
func VoiceWaveform(audio []byte) []byte {
	packets := opusPackets(audio)
	if len(packets) == 0 {
		return nil
	}
	bars := make([]float64, VoiceWaveformBars)
	peak := 0.0
	for i := range bars {
		from := i * len(packets) / VoiceWaveformBars
		to := max((i+1)*len(packets)/VoiceWaveformBars, from+1)
		to = min(to, len(packets))
		sum := 0
		for _, size := range packets[from:to] {
			if size > silentPacketMaxBytes {
				sum += size
			}
		}
		bars[i] = float64(sum) / float64(to-from)
		peak = max(peak, bars[i])
	}
	out := make([]byte, VoiceWaveformBars)
	if peak == 0 {
		return out
	}
	for i, bar := range bars {
		out[i] = byte(bar / peak * 100)
	}
	return out
}

// isSilent is whether every audio packet only codes silence: what a speech
// provider that answered nothing still sends, a note of the right length
// that plays no sound.
func isSilent(audio []byte) bool {
	packets := opusPackets(audio)
	for _, size := range packets {
		if size > silentPacketMaxBytes {
			return false
		}
	}
	return len(packets) > 0
}

// opusPackets is each audio packet's size in bytes, in order: the Ogg pages'
// lacing joined into packets (a packet may cross pages), less the two header
// packets (OpusHead, OpusTags). Reading stops at the first page cut short.
func opusPackets(audio []byte) []int {
	var sizes []int
	current := 0
	for offset := 0; offset+27 <= len(audio) && string(audio[offset:offset+4]) == "OggS"; {
		segments := int(audio[offset+26])
		body := offset + 27 + segments
		if body > len(audio) {
			break
		}
		size := 0
		for _, lacing := range audio[offset+27 : body] {
			size += int(lacing)
			current += int(lacing)
			if lacing < 255 {
				sizes = append(sizes, current)
				current = 0
			}
		}
		offset = body + size
	}
	if len(sizes) <= 2 {
		return nil
	}
	return sizes[2:]
}

package domain

// VoiceWaveformBars is how many bars a WhatsApp voice note's waveform holds,
// each 0 to 100, as the phone draws it.
const VoiceWaveformBars = 64

// silentPacketMaxBytes is the most an Opus packet spends on 20 ms of audio
// that only carries silence: libopus codes a 10 ms frame of digital silence
// in 3 bytes (6 per 20 ms), and speech, even at -45 dBFS, takes over 30,
// and its lowest bitrate, 6 kbit/s, is 15. Only packets of 10 ms or more
// are judged: in 2.5 and 5 ms frames at a low constant bitrate, audible
// audio comes in 3-byte packets, as small as silence.
const silentPacketMaxBytes = 8

// silenceJudgedTicks is the shortest packet, in 2.5 ms ticks, whose size
// tells silence from sound.
const silenceJudgedTicks = 4

// VoiceWaveform is the waveform a voice note sent as push-to-talk carries,
// drawn from the size of each Opus packet per 20 ms of audio: no decoder runs
// on the host, and a variable-bitrate packet grows with what it carries, so
// silence is flat and speech stands up. The phones treat a note without one
// as no voice note (whatsmeow#517: it plays on the web, not on the phone).
// Nil when the audio holds no packets.
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
		for _, packet := range packets[from:to] {
			if !packet.silent() {
				sum += packet.per20ms()
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
	for _, packet := range packets {
		if !packet.silent() {
			return false
		}
	}
	return len(packets) > 0
}

// opusPacket is one audio packet: its size in bytes, and how long it plays
// in 2.5 ms ticks, the shortest Opus frame.
type opusPacket struct {
	size  int
	ticks int
}

// per20ms is the packet's size scaled to 20 ms of audio.
func (p opusPacket) per20ms() int {
	return p.size * 8 / p.ticks
}

// silent is whether the packet's size shows it only codes silence. A packet
// too short to tell is not.
func (p opusPacket) silent() bool {
	return p.ticks >= silenceJudgedTicks && p.per20ms() <= silentPacketMaxBytes
}

// opusFrameTicks is each TOC configuration's frame length in 2.5 ms ticks
// (RFC 6716, section 3.1): SILK-only 10/20/40/60 ms, hybrid 10/20 ms,
// CELT-only 2.5/5/10/20 ms.
var opusFrameTicks = [32]int{
	4, 8, 16, 24, 4, 8, 16, 24, 4, 8, 16, 24,
	4, 8, 4, 8,
	1, 2, 4, 8, 1, 2, 4, 8, 1, 2, 4, 8, 1, 2, 4, 8,
}

// opusPacketTicks is how long a packet plays, read from its TOC byte and, for
// a packet of any number of frames, the frame count byte after it; a count
// that is out of reach counts one frame. Never below one tick.
func opusPacketTicks(toc byte, next []byte) int {
	frames := 1
	switch toc & 3 {
	case 1, 2:
		frames = 2
	case 3:
		if len(next) > 0 {
			frames = max(int(next[0]&0x3f), 1)
		}
	}
	return opusFrameTicks[toc>>3] * frames
}

// opusPackets is each audio packet, in order: the Ogg pages' lacing joined
// into packets (a packet may cross pages), less the two header packets
// (OpusHead, OpusTags). Reading stops at the first page cut short.
func opusPackets(audio []byte) []opusPacket {
	var packets []opusPacket
	current, ticks := 0, 0
	for offset := 0; offset+27 <= len(audio) && string(audio[offset:offset+4]) == "OggS"; {
		segments := int(audio[offset+26])
		body := offset + 27 + segments
		if body > len(audio) {
			break
		}
		at := body
		for _, lacing := range audio[offset+27 : body] {
			if current == 0 && lacing > 0 && at < len(audio) {
				ticks = opusPacketTicks(audio[at], audio[min(at+1, len(audio)):min(at+int(lacing), len(audio))])
			}
			at += int(lacing)
			current += int(lacing)
			if lacing < 255 {
				packets = append(packets, opusPacket{size: current, ticks: max(ticks, 1)})
				current, ticks = 0, 0
			}
		}
		offset = at
	}
	if len(packets) <= 2 {
		return nil
	}
	return packets[2:]
}

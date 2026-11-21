/**
 * The longest text one voice note speaks, in characters: about forty seconds
 * at a speaking pace. A reply longer than this reads better as text, and it
 * keeps the audio well inside what one link frame carries to the host.
 */
export const SPEECH_TEXT_MAX_CHARS = 600;

/** The longest voice note spoken, in seconds (`WHATSAPP_VOICE_SEND_MAX_SECONDS`). */
export const SPEECH_MAX_SECONDS = 120;

/** Opus always counts its granules at 48 kHz, whatever it was encoded from. */
const OPUS_GRANULE_RATE = 48_000;

/**
 * How long Ogg/Opus audio runs, in whole seconds rounded up, from its pages
 * alone: the first page must carry the Opus identification header (its
 * pre-skip is the encoder's lead-in, not sound), and the last page's granule
 * position is where the sound ends. Null for anything that is not whole
 * Ogg/Opus, so a provider that answered MP3 or an error page is refused
 * before it reaches anyone's phone as a broken note.
 */
export function oggOpusSeconds(audio: Buffer): number | null {
  const pages = oggPages(audio);
  if (!pages || pages.length === 0) return null;
  const first = pages[0];
  if (audio.toString('ascii', first.body, first.body + 8) !== 'OpusHead') return null;
  if (first.body + 12 > audio.length) return null;
  const preSkip = audio.readUInt16LE(first.body + 10);
  const granule = pages[pages.length - 1].granule;
  const samples = Number(granule) - preSkip;
  if (!Number.isFinite(samples) || samples <= 0) return null;
  return Math.ceil(samples / OPUS_GRANULE_RATE);
}

/** Each Ogg page's body offset and granule position; null when a page is cut short or not a page. */
function oggPages(audio: Buffer): { body: number; granule: bigint }[] | null {
  const pages: { body: number; granule: bigint }[] = [];
  let offset = 0;
  while (offset < audio.length) {
    if (offset + 27 > audio.length || audio.toString('ascii', offset, offset + 4) !== 'OggS') {
      return null;
    }
    const segments = audio[offset + 26];
    const body = offset + 27 + segments;
    if (body > audio.length) return null;
    let size = 0;
    for (let i = 0; i < segments; i++) size += audio[offset + 27 + i];
    if (body + size > audio.length) return null;
    pages.push({ body, granule: audio.readBigInt64LE(offset + 6) });
    offset = body + size;
  }
  return pages;
}

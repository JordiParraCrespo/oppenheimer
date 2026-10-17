/**
 * Whether `data` is a WAV file a speech model can take as it is: RIFF/WAVE,
 * an uncompressed PCM `fmt ` chunk at 16 bits, mono or stereo, and a `data`
 * chunk with something in it. Judged by the bytes, never the label the
 * browser gave the upload, the way session files are (`sniffSessionFile`).
 *
 * WAV because it is the one format every provider behind the API takes
 * unchanged: ChatGPT's dictation route has refused Ogg/Opus, and the console
 * encodes its recording itself, so it costs the person nothing.
 */
export function isPcmWav(data: Buffer): boolean {
  if (data.length < 44) return false;
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    return false;
  }
  let format: { pcm: boolean; channels: number; bits: number } | null = null;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= data.length) {
      format = {
        pcm: data.readUInt16LE(body) === 1,
        channels: data.readUInt16LE(body + 2),
        bits: data.readUInt16LE(body + 14),
      };
    }
    if (id === 'data') {
      return (
        format?.pcm === true &&
        format.bits === 16 &&
        (format.channels === 1 || format.channels === 2) &&
        size > 0 &&
        body < data.length
      );
    }
    // Chunks are padded to an even length.
    offset = body + size + (size % 2);
  }
  return false;
}

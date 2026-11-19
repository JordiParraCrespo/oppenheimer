/**
 * A voice note as a speech model takes it. WhatsApp records Ogg/Opus, and the
 * one format every speech provider behind the API takes unchanged is 16-bit
 * PCM WAV (`isPcmWav`, in `voice/`), so a note is decoded before it is heard.
 */
export interface VoiceNoteDecoderPort {
  /** The note as 16 kHz mono 16-bit PCM WAV; null when it is not Ogg/Opus or holds no sound. */
  toWav(note: Buffer): Promise<Buffer | null>;
}

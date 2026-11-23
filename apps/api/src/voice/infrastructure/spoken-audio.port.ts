/**
 * What spoken audio sounds like once decoded, which its pages alone cannot
 * say: a provider can answer whole Ogg/Opus of the right length that holds
 * only silence, and it reaches the phone as a voice note that plays nothing.
 */
export interface SpokenAudioPort {
  /** The loudest sample, 0 to 1, of Ogg/Opus audio; null when it does not decode. */
  peak(audio: Buffer): Promise<number | null>;
}

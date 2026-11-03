/** One recorded clip: 16-bit PCM WAV, already judged by its bytes. */
export interface VoiceClip {
  data: Buffer;
  /** ISO 639-1, when the speaker's language is known; the model guesses otherwise. */
  language?: string;
  /**
   * Names the speech model should expect (`speechPrompt`), for a provider
   * that takes a hint. Never a sentence: one in a language pulls the model
   * towards it.
   */
  prompt?: string;
}

/** A ChatGPT sign-in's access, as `TURN_CREDENTIALS` hands it out. A live credential: never logged. */
export interface ChatgptSpeechAccess {
  accessToken: string;
  accountId?: string;
}

/**
 * Transcription on a workspace's ChatGPT sign-in: ChatGPT's own dictation
 * route, the one the Codex CLI's push-to-talk calls. Undocumented, so an
 * answer that is not a transcript is `VOICE_006`, never a crash.
 */
export interface ChatgptSpeechPort {
  transcribe(clip: VoiceClip, access: ChatgptSpeechAccess): Promise<string>;
}

/**
 * Transcription on the deployment's own speech-to-text server, any
 * OpenAI-compatible `/audio/transcriptions` (`VOICE_STT_*`).
 */
export interface KeyedSpeechPort {
  /** Whether the deployment has one; `voice_transcription` says the same to the console. */
  isConfigured(): boolean;
  transcribe(clip: VoiceClip): Promise<string>;
}

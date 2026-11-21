/**
 * Speech synthesis on the deployment's own text-to-speech server, any
 * OpenAI-compatible `/audio/speech` (`VOICE_TTS_*`). One vendor route today,
 * so a port and its gateway are the whole shape (`provider-integrations.md`,
 * "What this is not"); a second vendor makes it a provider list.
 */
export interface SpeechSynthesisPort {
  /** Whether the deployment has one: a base URL and a model. Reads config only. */
  isConfigured(): boolean;
  /**
   * The text spoken, as the server answered it: asked for Ogg/Opus, and not
   * yet judged. Throws `VOICE_008` unconfigured, `VOICE_009` for anything that
   * is not audio, `VOICE_010` for a rate limit.
   */
  synthesize(text: string): Promise<Buffer>;
}

import type { VoiceClip } from './speech-to-text.port';

/** What a voice note is spoken with: the model and voice ids, as the provider's catalog names them. */
export interface SynthesisVoiceChoice {
  model: string;
  voice: string;
}

/**
 * Speech on a workspace's own OpenAI key (Settings → Model providers):
 * `/audio/transcriptions` to hear, `/audio/speech` to speak. The key is a live
 * credential: never logged, never a cache key.
 */
export interface OpenAiSpeechPort {
  transcribe(clip: VoiceClip, apiKey: string): Promise<string>;
  synthesize(text: string, apiKey: string, choice: SynthesisVoiceChoice): Promise<Buffer>;
}

/** Transcription on a workspace's own Groq key: Whisper on Groq's OpenAI-compatible route. */
export interface GroqSpeechPort {
  transcribe(clip: VoiceClip, apiKey: string): Promise<string>;
}

/** Speech on a workspace's own ElevenLabs key: Scribe to hear, its voices to speak. */
export interface ElevenlabsSpeechPort {
  transcribe(clip: VoiceClip, apiKey: string): Promise<string>;
  synthesize(text: string, apiKey: string, choice: SynthesisVoiceChoice): Promise<Buffer>;
}

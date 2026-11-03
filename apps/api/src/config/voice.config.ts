import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv, positiveInt } from './env';

/**
 * Dictation (`product/next-steps/voice.md`).
 *
 * A workspace signed in to ChatGPT transcribes on that sign-in and needs
 * nothing here. The `stt*` keys are optional capability config: the
 * deployment's own speech-to-text server, any OpenAI-compatible
 * `/audio/transcriptions` (OpenAI, Groq, a self-hosted Whisper), which every
 * other workspace dictates on. With the base URL and the model set the
 * `voice_transcription` capability is on; the key is optional because a
 * self-hosted server may take none.
 *
 * `polishModel` is the ChatGPT model the transcript is tidied with on a
 * sign-in; without a sign-in the polish runs on the deployment's LLM
 * (`LLM_*`), if it has one. `polishTimeoutMs` bounds it: past it the person
 * gets the raw transcript rather than a wait.
 *
 * `liveApiKey` is an OpenAI key for live dictation (the words in the field
 * while they are spoken, on OpenAI's realtime transcription); without it, a
 * `sttApiKey` for OpenAI's own base URL serves. `liveModel` is the realtime
 * model. Optional: without a key, dictation works as before, the text landing
 * when the recording stops.
 */
const schema = z.object({
  sttBaseUrl: z.string().url().optional(),
  sttApiKey: z.string().optional(),
  sttModel: z.string().optional(),
  polishModel: z.string().optional(),
  polishTimeoutMs: positiveInt(6_000),
  liveApiKey: z.string().optional(),
  liveModel: z.string().default('gpt-live-transcribe'),
});

export const voiceConfig = registerAs('voice', () =>
  parseEnv('voice', schema, {
    sttBaseUrl: 'VOICE_STT_BASE_URL',
    sttApiKey: 'VOICE_STT_API_KEY',
    sttModel: 'VOICE_STT_MODEL',
    polishModel: 'VOICE_POLISH_MODEL',
    polishTimeoutMs: 'VOICE_POLISH_TIMEOUT_MS',
    liveApiKey: 'VOICE_LIVE_API_KEY',
    liveModel: 'VOICE_LIVE_MODEL',
  }),
);

/** Whether the deployment has a speech-to-text server of its own: a base URL and a model. */
export function speechKeyIsConfigured(config: ConfigService): boolean {
  return Boolean(config.get<string>('voice.sttBaseUrl') && config.get<string>('voice.sttModel'));
}

import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv, positiveInt } from './env';

/**
 * Dictation.
 *
 * A workspace signed in to ChatGPT transcribes on that sign-in and needs
 * nothing here. The `stt*` keys are optional capability config: the
 * deployment's own speech-to-text server, any OpenAI-compatible
 * `/audio/transcriptions` (OpenAI, Groq, a self-hosted Whisper), which every
 * other workspace dictates on. With the base URL and the model set the
 * `voice_transcription` capability is on; the key is optional because a
 * self-hosted server may take none.
 *
 * The `tts*` keys are the deployment's own text-to-speech server, any
 * OpenAI-compatible `/audio/speech` that answers Ogg/Opus (OpenAI's
 * `gpt-4o-mini-tts` or `tts-1`, a self-hosted server with the same route),
 * which a bot speaks a WhatsApp voice note with. It is on only with
 * `ttsModel` set. With no `ttsBaseUrl` it calls the speech-to-text server's
 * base URL with that server's key, so one OpenAI key serves both; a
 * `ttsBaseUrl` of its own takes only `ttsApiKey`, so the speech-to-text key
 * never goes to another host. `ttsVoice` is the provider's voice name.
 *
 * `polishModel` is the ChatGPT model the transcript is tidied with on a
 * sign-in; without a sign-in the polish runs on the deployment's LLM
 * (`LLM_*`), if it has one. `polishTimeoutMs` bounds it: past it the person
 * gets the raw transcript rather than a wait.
 */
const schema = z.object({
  sttBaseUrl: z.string().url().optional(),
  sttApiKey: z.string().optional(),
  sttModel: z.string().optional(),
  ttsBaseUrl: z.string().url().optional(),
  ttsApiKey: z.string().optional(),
  ttsModel: z.string().optional(),
  ttsVoice: z.string().default('alloy'),
  polishModel: z.string().optional(),
  polishTimeoutMs: positiveInt(6_000),
});

export const voiceConfig = registerAs('voice', () =>
  parseEnv('voice', schema, {
    sttBaseUrl: 'VOICE_STT_BASE_URL',
    sttApiKey: 'VOICE_STT_API_KEY',
    sttModel: 'VOICE_STT_MODEL',
    ttsBaseUrl: 'VOICE_TTS_BASE_URL',
    ttsApiKey: 'VOICE_TTS_API_KEY',
    ttsModel: 'VOICE_TTS_MODEL',
    ttsVoice: 'VOICE_TTS_VOICE',
    polishModel: 'VOICE_POLISH_MODEL',
    polishTimeoutMs: 'VOICE_POLISH_TIMEOUT_MS',
  }),
);

/** Whether the deployment has a speech-to-text server of its own: a base URL and a model. */
export function speechKeyIsConfigured(config: ConfigService): boolean {
  return Boolean(config.get<string>('voice.sttBaseUrl') && config.get<string>('voice.sttModel'));
}

/**
 * Whether the deployment can speak a voice note: a text-to-speech model, and
 * a base URL of its own or the speech-to-text server's.
 */
export function speechSynthesisIsConfigured(config: ConfigService): boolean {
  return Boolean(
    config.get<string>('voice.ttsModel') &&
      (config.get<string>('voice.ttsBaseUrl') ?? config.get<string>('voice.sttBaseUrl')),
  );
}

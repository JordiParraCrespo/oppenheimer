import { z } from 'zod';
import {
  BOT_PROVIDER_CATALOG,
  BOT_PROVIDERS,
  type BotProvider,
  type BotProviderAuth,
} from './bot.schema.js';

/**
 * Settings → Model providers: every provider a workspace can store a key or a
 * sign-in for, and what each one serves. The bot providers are the first five
 * (`BOT_PROVIDERS`); after them the ones that only hear and speak: Groq
 * (Whisper transcription) and ElevenLabs (transcription and voices). A
 * speech-only provider is never offered to a bot and is never the default.
 */
export const SPEECH_ONLY_PROVIDERS = ['groq', 'elevenlabs'] as const;
export type SpeechOnlyProvider = (typeof SPEECH_ONLY_PROVIDERS)[number];

export const MODEL_PROVIDERS = [...BOT_PROVIDERS, ...SPEECH_ONLY_PROVIDERS] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const modelProviderSchema = z.enum(MODEL_PROVIDERS);

/** What a provider's credential can be used for: running a bot, hearing a clip, speaking a voice note. */
export type ModelProviderUse = 'bots' | 'transcription' | 'speech';

export interface ModelProviderDefinition {
  readonly id: ModelProvider;
  readonly label: string;
  readonly auth: BotProviderAuth;
  readonly uses: readonly ModelProviderUse[];
}

const bot = (id: BotProvider, uses: readonly ModelProviderUse[]): ModelProviderDefinition =>
  Object.freeze({
    id,
    label: BOT_PROVIDER_CATALOG[id].label,
    auth: BOT_PROVIDER_CATALOG[id].auth,
    uses: Object.freeze(uses),
  });

/** Every provider, in the order Settings → Model providers lists them. */
export const MODEL_PROVIDER_CATALOG: Readonly<Record<ModelProvider, ModelProviderDefinition>> =
  Object.freeze({
    anthropic: bot('anthropic', ['bots']),
    glm: bot('glm', ['bots']),
    openai: bot('openai', ['bots', 'transcription', 'speech']),
    chatgpt: bot('chatgpt', ['bots', 'transcription']),
    xai: bot('xai', ['bots']),
    groq: Object.freeze({
      id: 'groq',
      label: 'Groq',
      auth: 'api_key',
      uses: Object.freeze(['transcription'] as const),
    }),
    elevenlabs: Object.freeze({
      id: 'elevenlabs',
      label: 'ElevenLabs',
      auth: 'api_key',
      uses: Object.freeze(['transcription', 'speech'] as const),
    }),
  });

/** Whether a stored credential's provider can run a bot. */
export function isBotProvider(provider: ModelProvider): provider is BotProvider {
  return (BOT_PROVIDERS as readonly string[]).includes(provider);
}

/** The bot providers among `providers`, in their order: a voice-only key (Groq, ElevenLabs) never runs a bot. */
export function botProvidersOf(providers: readonly ModelProvider[]): BotProvider[] {
  return providers.filter(isBotProvider);
}

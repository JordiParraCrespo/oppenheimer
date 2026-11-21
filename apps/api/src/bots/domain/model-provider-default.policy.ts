import { type BotProvider, isBotProvider } from '@oppenheimer/shared';
import { providerForNewBot } from './bot-creation.policy';
import type { ModelProviderCredentialEntity } from './model-provider-credential.entity';

/**
 * The provider a new bot starts on: the key the workspace marked as its
 * default; with none marked, `providerForNewBot` over the providers it has keys
 * for. A speech-only provider's key (Groq, ElevenLabs) is never one.
 */
export function defaultBotProvider(
  credentials: readonly ModelProviderCredentialEntity[],
): BotProvider {
  const bots = credentials.flatMap(({ provider, markedDefault }) =>
    isBotProvider(provider) ? [{ provider, markedDefault }] : [],
  );
  const marked = bots.find((credential) => credential.markedDefault);
  if (marked) return marked.provider;
  return providerForNewBot(bots.map((credential) => credential.provider));
}

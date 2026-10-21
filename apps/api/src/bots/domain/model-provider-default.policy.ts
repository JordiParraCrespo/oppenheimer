import type { BotProvider } from '@oppenheimer/shared';
import { providerForNewBot } from './bot-creation.policy';
import type { ModelProviderCredentialEntity } from './model-provider-credential.entity';

/**
 * The provider a new bot starts on (`product/versions/mvp/25-bots.md` §2): the
 * key the workspace marked as its default; with none marked,
 * `providerForNewBot` over the providers it has keys for.
 */
export function defaultBotProvider(
  credentials: readonly ModelProviderCredentialEntity[],
): BotProvider {
  const marked = credentials.find((credential) => credential.markedDefault);
  if (marked) return marked.provider;
  return providerForNewBot(credentials.map((credential) => credential.provider));
}

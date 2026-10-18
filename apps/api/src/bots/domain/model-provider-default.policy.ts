import type { BotProvider } from '@oppenheimer/shared';
import type { ModelProviderCredentialEntity } from './model-provider-credential.entity';

/** The provider a workspace with no key at all starts its bots on. */
export const FALLBACK_BOT_PROVIDER: BotProvider = 'anthropic';

/**
 * The provider a new bot starts on (`product/versions/mvp/25-bots.md` §2): the
 * key the workspace marked as its default; with none marked, the key it stored
 * first, so a workspace with one key starts its bots on that one; with no key
 * at all, Anthropic.
 */
export function defaultBotProvider(
  credentials: readonly ModelProviderCredentialEntity[],
): BotProvider {
  const marked = credentials.find((credential) => credential.markedDefault);
  if (marked) return marked.provider;
  const [first] = [...credentials].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return first?.provider ?? FALLBACK_BOT_PROVIDER;
}

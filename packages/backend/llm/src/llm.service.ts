import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProviderId,
  LlmProviderSetting,
} from './llm.types';
import { ProviderPause } from './rate-limit';

/**
 * The shared contract every provider implements, and the DI token consumers
 * depend on.
 *
 * One call, `complete`, because that is what the product needs today: a
 * session's title. Streaming, tools and embeddings are deliberately not here:
 * they are added to this class when something needs them, and every provider
 * then has to answer for them.
 *
 * `complete` throws an {@link LlmError} on every failure. Swallowing is the
 * caller's decision, because only the caller knows what the fallback is.
 */
export abstract class LlmService {
  abstract readonly provider: LlmProviderId | LlmProviderSetting;

  /** The provider's rate-limit pause, for the lifetime of this service (`rate-limit.ts`). */
  protected readonly pause = new ProviderPause();

  /** Whether a call can be made at all. False for the no-op service. */
  abstract isConfigured(): boolean;

  /** The model a request that names none is sent to, if there is one. */
  abstract readonly defaultModel: string | undefined;

  abstract complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}

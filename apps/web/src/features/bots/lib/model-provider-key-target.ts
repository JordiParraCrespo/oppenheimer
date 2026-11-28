import type { ModelProvider } from '@oppenheimer/shared/schemas/model-provider';

/**
 * What the key dialog stores: the provider's key (its first, replaced or
 * added when there is none), another key after the ones there, or one key
 * replaced in its place.
 */
export type ModelProviderKeyTarget =
  | { mode: 'put'; provider: ModelProvider }
  | { mode: 'add'; provider: ModelProvider }
  | { mode: 'replace'; provider: ModelProvider; keyId: string; hint: string };

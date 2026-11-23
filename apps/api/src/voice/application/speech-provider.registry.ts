import { VOICE_PROVIDERS, type VoiceProvider } from '@oppenheimer/shared';
import type { SpeechProvider } from './speech-provider.port';

/**
 * The speech providers this deployment knows, in the order a dictation tries
 * them: the first one available for the workspace hears it, and the next is
 * tried when it fails for any reason but a rate limit. The order is
 * `VOICE_PROVIDERS`'s and nowhere else's: `inCatalogOrder` takes one provider
 * per id, so an id added there does not compile until `voice.module.ts` names
 * its provider.
 */
export class SpeechProviderRegistry {
  static inCatalogOrder(
    byId: Readonly<Record<VoiceProvider, SpeechProvider>>,
  ): SpeechProviderRegistry {
    return new SpeechProviderRegistry(VOICE_PROVIDERS.map((id) => byId[id]));
  }

  constructor(private readonly providers: readonly SpeechProvider[]) {
    const ids = providers.map((provider) => provider.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Two speech providers share an id: ${ids.join(', ')}`);
    }
  }

  /** Every provider, in order. */
  all(): readonly SpeechProvider[] {
    return this.providers;
  }

  /** The providers this workspace can use now, in order: the console's mic shows when there is one. */
  async availableFor(organizationId: string): Promise<SpeechProvider[]> {
    const answers = await Promise.all(
      this.providers.map((provider) => provider.availableFor(organizationId)),
    );
    return this.providers.filter((_, index) => answers[index]);
  }
}

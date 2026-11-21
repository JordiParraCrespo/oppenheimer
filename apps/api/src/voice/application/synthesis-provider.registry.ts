import { SYNTHESIS_PROVIDERS, type SynthesisProvider } from '@oppenheimer/shared';
import type { Synthesizer } from './synthesis-provider.port';

/**
 * The speech synthesis providers this deployment knows, in the order a voice
 * note tries them when the workspace chose none: `SYNTHESIS_PROVIDERS`'s
 * order and nowhere else's, `inCatalogOrder` taking one provider per id.
 */
export class SynthesisProviderRegistry {
  static inCatalogOrder(
    byId: Readonly<Record<SynthesisProvider, Synthesizer>>,
  ): SynthesisProviderRegistry {
    return new SynthesisProviderRegistry(SYNTHESIS_PROVIDERS.map((id) => byId[id]));
  }

  constructor(private readonly providers: readonly Synthesizer[]) {
    const ids = providers.map((provider) => provider.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Two synthesis providers share an id: ${ids.join(', ')}`);
    }
  }

  all(): readonly Synthesizer[] {
    return this.providers;
  }

  /** The providers this workspace can speak on now, in order. */
  async availableFor(organizationId: string): Promise<Synthesizer[]> {
    const answers = await Promise.all(
      this.providers.map((provider) => provider.availableFor(organizationId)),
    );
    return this.providers.filter((_, index) => answers[index]);
  }
}

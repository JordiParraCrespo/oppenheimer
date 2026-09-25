import type {
  ClientFeatureFlagKey,
  ClientFeatureFlags,
  FlagValue,
} from '@oppenheimer/shared/feature-flags';
import { getFlagDefinition } from '@oppenheimer/shared/feature-flags/catalog';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { AuthStore } from '../auth/auth.state';
import type { FeatureFlagsClientContext } from './feature-flags.client';
import type { FeatureFlagsRepository } from './feature-flags.repository';

/**
 * The client side of feature flags: fetch the caller's evaluated flags, and
 * record an exposure when an experiment's variant is actually shown.
 *
 * Flags are evaluated on the server. The client never sees a rule, only its
 * own answers, so there is nothing here to evaluate — and nothing a curious
 * user can read out of the bundle about who else gets what.
 *
 * `get()` rejects on failure, deliberately. The query layer keeps the last
 * good answer through a failed refetch (and the persisted cache keeps it
 * across a cold start); resolving to defaults instead would overwrite a pulled
 * kill switch with its default the moment the network blinked.
 */
@injectable()
export class FeatureFlagsService {
  private readonly exposed = new Set<string>();

  constructor(
    @inject(TOKENS.FeatureFlagsRepository)
    private readonly repository: FeatureFlagsRepository,
    @inject(TOKENS.FeatureFlagsClientContext)
    private readonly context: FeatureFlagsClientContext,
    @inject(TOKENS.AnalyticsService)
    private readonly analytics: AnalyticsService,
    @inject(TOKENS.AuthStore)
    auth: AuthStore,
  ) {
    // The exposures seen belong to whoever saw them. Signing in or out starts
    // a new person's record, so the next user on a shared device is not
    // skipped for a variant the last one was shown.
    auth.subscribe((state, previous) => {
      if (state.isAuthenticated !== previous.isAuthenticated) this.exposed.clear();
    });
  }

  get(): Promise<ClientFeatureFlags> {
    return this.repository.get(this.context);
  }

  /**
   * Records that the caller saw an experiment's variant, once per variant for
   * each signed-in (or signed-out) stretch. Only `experiment` flags are recorded: an exposure is what lets a
   * result be attributed to the arm someone was actually shown, and a release
   * or ops flag has no result to attribute.
   */
  recordExposure(key: ClientFeatureFlagKey, value: FlagValue): void {
    if (getFlagDefinition(key).kind !== 'experiment') return;

    const id = `${key}:${String(value)}`;
    if (this.exposed.has(id)) return;
    this.exposed.add(id);

    this.analytics.capture(ANALYTICS_EVENTS.FEATURE_FLAG_EXPOSED, { flag: key, variant: value });
  }
}

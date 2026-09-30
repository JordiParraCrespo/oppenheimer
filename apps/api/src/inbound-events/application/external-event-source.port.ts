import type { ExternalTriggerSource } from '@oppenheimer/shared/automations';
import type { ExternalEvent, InboundDelivery } from '../domain/external-event.types';

/**
 * The one port a provider implements to feed the hub
 * (`product/versions/mvp/16-automations-architecture.md` §Q6), contributed with
 * `InboundEventsModule.contributeSources`.
 *
 * Signature verification is not here: the provider module's own endpoint owns its
 * secret and verifies before anything is stored, so the hub never holds a byte nobody
 * authenticated.
 */
export interface ExternalEventSourcePort {
  readonly id: ExternalTriggerSource;

  /**
   * Whether an event name is one this source turns into catalog events at all.
   * Anything else is acknowledged and dropped at the door, never stored.
   */
  accepts(eventName: string): boolean;

  /**
   * Which workspaces a delivery concerns. A GitHub delivery names one
   * installation, which one workspace holds; a Slack team can be linked to
   * several, which is why this is a list.
   */
  resolveTenants(delivery: InboundDelivery): Promise<string[]>;

  /**
   * The canonical events a delivery is. Pure: the same delivery always
   * normalizes the same way, which is what makes re-processing safe. Zero
   * events is a delivery the catalog has no trigger for (an action nobody
   * listens to, a pre-release, a push that deleted a branch).
   */
  normalize(delivery: InboundDelivery): ExternalEvent[];
}

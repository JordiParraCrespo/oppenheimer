import type { ExternalEvent } from './external-event.types';

/** Raw bodies: the replay window. */
export const DELIVERY_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an event is too old to have arrived in a genuine delivery, relative
 * to when its delivery was received.
 *
 * The payload digest (`inbound_delivery."payloadDigest"`) refuses the same
 * signed bytes twice only while the first delivery is still stored — for
 * `DELIVERY_RETENTION_DAYS`. A body replayed after its row was purged would be
 * accepted again, so an event whose own time is older than that window, less a
 * day of slack for GitHub's retries, is dropped. It covers only events that
 * carry their own time: a normalizer that falls back to the receipt time for a
 * payload with none produces an event this can never call old, and for those
 * the digest window is the only control.
 */
export function isBeyondReplayWindow(event: Pick<ExternalEvent, 'occurredAt'>, receivedAt: Date) {
  const windowMs = (DELIVERY_RETENTION_DAYS - 1) * DAY_MS;
  return receivedAt.getTime() - event.occurredAt.getTime() > windowMs;
}

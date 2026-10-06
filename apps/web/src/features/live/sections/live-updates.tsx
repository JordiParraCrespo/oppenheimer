import { useLiveEvents } from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';

/**
 * The live stream, open for as long as a signed-in screen is, while the
 * `live_events` flag allows it (`product/versions/mvp/21-live-events.md`).
 * It draws nothing: what it hears refreshes the screens that read sessions.
 */
export function LiveUpdates() {
  useLiveEvents(useFeatureFlag('live_events'));
  return null;
}

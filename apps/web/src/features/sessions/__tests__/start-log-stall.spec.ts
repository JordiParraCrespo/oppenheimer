import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { describe, expect, it } from 'vitest';
import { startLogStalled } from '../lib/start-log-stall';

const START_LOG_STALL_MS = CONSUMER_CONFIG.sessions.startLogStallMs;

/**
 * The start pane polls the session's log while it starts. One failed read
 * with a working one a tick later must not put "Could not reach the server"
 * over a stepper that keeps advancing (it did, on most starts over a flaky
 * link); reads that keep failing must still say so. A regression that showed
 * every failed read brings the false alarm back; one that never compared
 * against the last good read hides a real outage.
 */
const WATCHING_SINCE = 1_000_000;
const error = new Error('Failed to fetch');

describe('startLogStalled', () => {
  it('stays quiet when nothing failed', () => {
    expect(
      startLogStalled({ error: null, errorUpdatedAt: 0, dataUpdatedAt: 0 }, WATCHING_SINCE),
    ).toBe(false);
  });

  it('stays quiet for a failure soon after the last good read', () => {
    const lastGood = WATCHING_SINCE + 2000;
    expect(
      startLogStalled(
        { error, errorUpdatedAt: lastGood + START_LOG_STALL_MS - 1, dataUpdatedAt: lastGood },
        WATCHING_SINCE,
      ),
    ).toBe(false);
  });

  it('speaks once reads have failed for the whole grace since the last good one', () => {
    const lastGood = WATCHING_SINCE + 2000;
    expect(
      startLogStalled(
        { error, errorUpdatedAt: lastGood + START_LOG_STALL_MS, dataUpdatedAt: lastGood },
        WATCHING_SINCE,
      ),
    ).toBe(true);
  });

  it('counts from when the pane began watching a log the create seeded and nobody read', () => {
    // The create seeds the log with `updatedAt: 0`, so the first failed read
    // would otherwise look like one that had failed since 1970.
    expect(
      startLogStalled(
        { error, errorUpdatedAt: WATCHING_SINCE + 1000, dataUpdatedAt: 0 },
        WATCHING_SINCE,
      ),
    ).toBe(false);
    expect(
      startLogStalled(
        { error, errorUpdatedAt: WATCHING_SINCE + START_LOG_STALL_MS, dataUpdatedAt: 0 },
        WATCHING_SINCE,
      ),
    ).toBe(true);
  });
});

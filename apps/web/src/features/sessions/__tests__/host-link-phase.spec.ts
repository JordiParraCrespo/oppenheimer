import { describe, expect, it } from 'vitest';
import { hostLinkPhaseOf } from '../lib/host-link-phase';

/**
 * The band under the terminal draws one phase of the host link. The stream
 * alone cannot say the host is coming back, or that it just did: a blip and a
 * host away look the same to it while it dials, and live is live. These are
 * the readings that would draw the wrong band if they slipped.
 */
const at = (over: Partial<Parameters<typeof hostLinkPhaseOf>[0]>) =>
  hostLinkPhaseOf({ status: 'live', away: false, reconnected: false, slow: false, ...over });

describe('hostLinkPhaseOf', () => {
  it('reads host_offline as offline until the stream is attached again', () => {
    // The host list keeps a dead runner online for thirty seconds; the relay
    // saying host_offline is what the reader is shown.
    expect(at({ status: 'offline', away: true })).toBe('offline');
  });

  it('reads a slow dial as a blip, unless the host was away', () => {
    expect(at({ status: 'connecting', slow: true })).toBe('reconnecting');
    expect(at({ status: 'connecting', away: true })).toBe('catching-up');
  });

  it('stays live for a dial inside its grace', () => {
    // Switching sessions dials; "Connecting… Retry now" flashed on every switch.
    expect(at({ status: 'connecting' })).toBe('live');
  });

  it('says reconnected for a moment after coming back, then live', () => {
    expect(at({ reconnected: true })).toBe('reconnected');
    expect(at({})).toBe('live');
  });

  it('draws no host link for a stream that ended', () => {
    expect(at({ status: 'closed' })).toBeNull();
  });
});

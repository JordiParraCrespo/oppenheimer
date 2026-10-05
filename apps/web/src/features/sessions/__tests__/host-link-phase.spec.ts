import { describe, expect, it } from 'vitest';
import { hostLinkPhaseOf } from '../lib/host-link-phase';

/**
 * The band under the terminal draws one phase of the host link. The stream
 * alone cannot say the host is coming back, or that it just did: a blip and a
 * host away look the same to it while it dials, and live is live. These are
 * the readings that would draw the wrong band if they slipped.
 */
const at = (over: Partial<Parameters<typeof hostLinkPhaseOf>[0]>) =>
  hostLinkPhaseOf({ status: 'live', away: false, hostBack: false, reconnected: false, ...over });

describe('hostLinkPhaseOf', () => {
  it('reads host_offline as offline, and as catching up once the host list finds it again', () => {
    expect(at({ status: 'offline', away: true })).toBe('offline');
    expect(at({ status: 'offline', away: true, hostBack: true })).toBe('catching-up');
  });

  it('reads a dial as a blip, unless the host was away', () => {
    expect(at({ status: 'connecting' })).toBe('reconnecting');
    expect(at({ status: 'connecting', away: true })).toBe('catching-up');
  });

  it('says reconnected for a moment after coming back, then live', () => {
    expect(at({ reconnected: true })).toBe('reconnected');
    expect(at({})).toBe('live');
  });

  it('draws no host link for a stream that ended', () => {
    expect(at({ status: 'closed' })).toBeNull();
  });
});

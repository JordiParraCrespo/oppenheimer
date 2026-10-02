import type { StreamStatus } from '@oppenheimer/frontend-consumer';
import type { HostReach } from '@oppenheimer/frontend-consumer/react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHostReturn } from '../hooks/use-host-return';

/**
 * A terminal told `host_offline` redials the moment its host is back, rather
 * than sitting out the ladder's thirty-second rung. Only the change from
 * offline to online dials: a host the list still calls online while the relay
 * says otherwise would otherwise reset the ladder on every poll.
 */

let reach: HostReach | undefined;
const watched: boolean[] = [];
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHostReach: (_hostId: string, watching: boolean) => {
    watched.push(watching);
    return reach;
  },
}));

function render(status: StreamStatus) {
  const redial = vi.fn();
  const hook = renderHook(({ status }) => useHostReturn('h-1', status, redial), {
    initialProps: { status },
  });
  return { redial, ...hook };
}

describe('useHostReturn', () => {
  beforeEach(() => {
    reach = undefined;
    watched.length = 0;
  });

  it('watches the host only while the terminal is offline', () => {
    const { rerender } = render('live');
    expect(watched.at(-1)).toBe(false);
    rerender({ status: 'offline' });
    expect(watched.at(-1)).toBe(true);
  });

  it('redials once when the host comes back', () => {
    reach = { name: 'laptop', online: false };
    const { redial, rerender } = render('offline');
    expect(redial).not.toHaveBeenCalled();

    reach = { name: 'laptop', online: true };
    rerender({ status: 'offline' });
    rerender({ status: 'offline' });
    expect(redial).toHaveBeenCalledTimes(1);
  });

  it('does not redial on a host the list already called online', () => {
    reach = { name: 'laptop', online: true };
    const { redial, rerender } = render('offline');
    rerender({ status: 'offline' });
    expect(redial).not.toHaveBeenCalled();
  });
});

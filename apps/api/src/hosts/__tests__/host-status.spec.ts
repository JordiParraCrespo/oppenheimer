import { describe, expect, it } from 'vitest';
import { hostStatusOf } from '../domain/host-status.policy';

describe('hostStatusOf', () => {
  it('reads an online host with a session up as running', () => {
    expect(hostStatusOf({ unpaired: false, online: true, runningSessions: 2 })).toBe('running');
  });

  it('reads an online host with nothing up as idle', () => {
    expect(hostStatusOf({ unpaired: false, online: true, runningSessions: 0 })).toBe('idle');
  });

  it('never calls an offline host running on the strength of sessions it cannot hear', () => {
    expect(hostStatusOf({ unpaired: false, online: false, runningSessions: 3 })).toBe('offline');
  });

  it('reads a removed host as unpaired whatever else is true', () => {
    expect(hostStatusOf({ unpaired: true, online: true, runningSessions: 1 })).toBe('unpaired');
  });
});

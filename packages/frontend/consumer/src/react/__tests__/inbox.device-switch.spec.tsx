import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  useInboxAlertsOn,
  useMutedSessionAlerts,
  useUnattendedSessionsShown,
} from '../inbox.queries';

/**
 * "Notify me in this browser" is one switch for the whole browser: turned off
 * in one tab, every other open tab stops telling, without a reload. Before,
 * each tab kept the value it first read and went on notifying.
 */
describe('the per-device switches', () => {
  it('follow a change another tab wrote', () => {
    const { result } = renderHook(() => useInboxAlertsOn());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    act(() => {
      localStorage.setItem('oppenheimer.inbox.alerts', 'false');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'oppenheimer.inbox.alerts', newValue: 'false' }),
      );
    });
    expect(result.current[0]).toBe(false);
  });

  // The regression: a switch that is on by default read as off on a device
  // that never stored it, and as off again when another tab cleared storage.
  it('start on when on by default, and fall back to on when another tab clears it', () => {
    const { result } = renderHook(() => useUnattendedSessionsShown());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    act(() => {
      localStorage.removeItem('oppenheimer.inbox.unattended');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'oppenheimer.inbox.unattended', newValue: null }),
      );
    });
    expect(result.current[0]).toBe(true);
  });

  it('ignore another key changing', () => {
    const { result } = renderHook(() => useInboxAlertsOn());
    act(() => result.current[1](true));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'something.else', newValue: 'false' }),
      );
    });
    expect(result.current[0]).toBe(true);
  });
});

/**
 * A session muted from its row stays muted in every open tab, and a reload
 * keeps it: before, a mute made in one tab let another go on notifying.
 */
describe('the muted sessions', () => {
  it('keep a mute and follow another tab taking it off', () => {
    const { result } = renderHook(() => useMutedSessionAlerts());
    act(() => result.current[1]('s1', true));
    expect(result.current[0].has('s1')).toBe(true);
    expect(JSON.parse(localStorage.getItem('oppenheimer.sessions.muted') ?? '[]')).toEqual(['s1']);

    act(() => {
      localStorage.setItem('oppenheimer.sessions.muted', '[]');
      window.dispatchEvent(new StorageEvent('storage', { key: 'oppenheimer.sessions.muted' }));
    });
    expect(result.current[0].has('s1')).toBe(false);
  });
});

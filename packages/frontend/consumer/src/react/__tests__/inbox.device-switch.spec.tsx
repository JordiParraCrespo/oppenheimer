import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInboxAlertsOn } from '../inbox.queries';

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

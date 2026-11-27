import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReadOnOpen } from '../hooks/use-read-on-open';

/**
 * A session's pane reads its finished turn on open, except on an Inbox card,
 * which lists the session because that turn is unread. The regression: the
 * card's Reply here opened the pane, the pane read the turn, the session left
 * the Inbox and the card vanished under the reader.
 */

const acknowledge = vi.fn();
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useAcknowledgeSessionReport: () => ({ mutate: acknowledge }),
}));

afterEach(() => {
  cleanup();
  acknowledge.mockClear();
});

describe('useReadOnOpen', () => {
  const blue = sessionEntity({ id: 's1', state: 'ready-for-review' });

  it('reads a finished turn when the pane opens', () => {
    renderHook(() => useReadOnOpen(blue));
    expect(acknowledge).toHaveBeenCalledWith('s1');
  });

  it('leaves it unread where the pane is told not to read', () => {
    renderHook(() => useReadOnOpen(blue, false));
    expect(acknowledge).not.toHaveBeenCalled();
  });
});

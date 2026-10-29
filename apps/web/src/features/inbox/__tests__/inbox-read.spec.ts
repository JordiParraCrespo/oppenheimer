import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMarkRead } from '../hooks/use-inbox-read';
import { inboxRead } from '../lib/inbox-read';

/**
 * An item is read once the reading pane shows it. On a phone the pane is
 * hidden until an item is opened, so the first item, which the pane would
 * hold, stays unread there until the reader opens it; side by side, the pane
 * shows it at once.
 */

const viewport = (sideBySide: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: sideBySide, media: query }));

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('useMarkRead', () => {
  it('leaves the first item unread on a phone until it is opened', () => {
    viewport(false);
    const { rerender } = renderHook(({ opened }) => useMarkRead('approval:phone', opened), {
      initialProps: { opened: false },
    });
    expect(inboxRead.get().has('approval:phone')).toBe(false);

    rerender({ opened: true });
    expect(inboxRead.get().has('approval:phone')).toBe(true);
  });

  it('reads the item in the pane at once beside the list', () => {
    viewport(true);
    renderHook(() => useMarkRead('approval:wide', false));
    expect(inboxRead.get().has('approval:wide')).toBe(true);
  });
});

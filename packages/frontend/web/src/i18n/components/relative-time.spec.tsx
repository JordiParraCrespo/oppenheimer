import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelativeTime } from './relative-time';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'en', language: 'en' } }),
}));

const NOW = new Date('2026-09-28T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RelativeTime', () => {
  it('words the distance in the reader’s language', () => {
    const { container } = render(<RelativeTime date={new Date(NOW.getTime() - 2 * 3_600_000)} />);
    expect(container.textContent).toBe('2 hours ago');
  });

  it('hands the last minute to the caller as null', () => {
    const { container } = render(
      <RelativeTime date={NOW}>{(when) => when ?? 'Active now'}</RelativeTime>,
    );
    expect(container.textContent).toBe('Active now');
  });

  it('moves with its own clock', () => {
    const { container } = render(
      <RelativeTime date={NOW}>{(when) => when ?? 'Active now'}</RelativeTime>,
    );
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(container.textContent).toBe('2 minutes ago');
  });
});

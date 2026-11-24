import { describe, expect, it } from 'vitest';
import { alertText, shouldAlert } from '../lib/session-alerts';

/**
 * A system notification is for a reader who is not looking: never without
 * their switch and the browser's permission, and never over the tab they are
 * reading, where the Inbox already shows the wait.
 */
const page = (visibilityState: DocumentVisibilityState, focused: boolean) => ({
  visibilityState,
  hasFocus: () => focused,
});

describe('when a new wait is told with a notification', () => {
  it('tells a reader on another tab or window', () => {
    expect(shouldAlert(true, 'granted', page('hidden', false))).toBe(true);
    expect(shouldAlert(true, 'granted', page('visible', false))).toBe(true);
  });

  it('stays quiet on the tab the reader is looking at', () => {
    expect(shouldAlert(true, 'granted', page('visible', true))).toBe(false);
  });

  it('stays quiet without the switch or the browser permission', () => {
    expect(shouldAlert(false, 'granted', page('hidden', false))).toBe(false);
    expect(shouldAlert(true, 'default', page('hidden', false))).toBe(false);
    expect(shouldAlert(true, 'denied', page('hidden', false))).toBe(false);
    expect(shouldAlert(true, undefined, page('hidden', false))).toBe(false);
  });
});

describe("a notification's words", () => {
  const copy = {
    sender: 's',
    source: 'src',
    short: 'S is waiting on you',
    title: 'Run pnpm test?',
    body: 'Answer it',
  };

  it('says who waits, then what it asks', () => {
    expect(alertText(copy)).toEqual({ title: 'S is waiting on you', body: 'Run pnpm test?' });
  });

  it('falls back to the sentence under the card when the question repeats the subject', () => {
    expect(alertText({ ...copy, title: copy.short })).toEqual({
      title: copy.short,
      body: 'Answer it',
    });
  });
});

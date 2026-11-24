import { describe, expect, it } from 'vitest';
import { noticeOccurrenceKey, sessionOccurrenceKey } from '../occurrence-keys.js';

/**
 * The console's Inbox and the Chrome extension name a wait by this one key:
 * the extension tells each occurrence once, and a mark in the Inbox hides
 * only that occurrence. The console holds `observedSince` as a Date and the
 * extension reads it off the wire as a string; the two must give one key, or
 * the extension would re-tell what the Inbox already shows as one item.
 */
const base = { id: 's1', lifecycle: 'open', stateSeq: 4, decision: null };

describe('the occurrence keys', () => {
  it('names a wait by the decision its agent asks', () => {
    expect(sessionOccurrenceKey({ ...base, observedSince: null, decision: { id: 'd1' } })).toBe(
      'session:s1:d1',
    );
  });

  it('names a blocked agent by when it blocked, the same from a Date or the wire', () => {
    const at = '2026-11-24T09:00:00.000Z';
    expect(sessionOccurrenceKey({ ...base, observedSince: new Date(at) })).toBe(`session:s1:${at}`);
    expect(sessionOccurrenceKey({ ...base, observedSince: at })).toBe(`session:s1:${at}`);
  });

  it('names a failed session by its change count', () => {
    expect(sessionOccurrenceKey({ ...base, lifecycle: 'failed', observedSince: null })).toBe(
      'session:s1:s4',
    );
  });

  it('names a notice by its own id', () => {
    expect(noticeOccurrenceKey('s1', 'n1')).toBe('notice:s1:n1');
  });
});

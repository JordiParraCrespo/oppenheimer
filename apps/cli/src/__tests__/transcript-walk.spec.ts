import { describe, expect, it } from 'vitest';
import type { SessionTranscriptPage } from '../lib/api-types';
import { readWholeTranscript, type TranscriptPageReader } from '../lib/transcript';

/**
 * `opp sessions transcript --all`: a session's whole conversation, read from
 * its first entry and on with each page's cursor until the agent's last,
 * with nothing lost, nothing read twice and every way it stops said. The
 * pages themselves (bounds, redaction) are the API's and the runner's specs.
 */

const entry = (id: string): SessionTranscriptPage['entries'][number] => ({
  id,
  at: null,
  role: 'assistant',
  parts: [{ kind: 'text', text: id, tool: null, isError: false, truncated: false }],
});

const page = (over: Partial<SessionTranscriptPage>): SessionTranscriptPage => ({
  status: 'complete',
  reason: null,
  detail: null,
  vendorUrl: null,
  entries: [],
  nextCursor: null,
  atEnd: false,
  hasEarlier: false,
  restarted: false,
  dropped: 0,
  redactions: 0,
  ...over,
});

/** A host serving `ids` in pages of `size`, cursors being the offset as text. */
function host(ids: string[], size: number): { read: TranscriptPageReader; asked: unknown[] } {
  const asked: unknown[] = [];
  const read: TranscriptPageReader = async (query) => {
    asked.push(query);
    const at = query.cursor ? Number(query.cursor) : query.from === 'start' ? 0 : ids.length - size;
    const next = Math.min(at + size, ids.length);
    return page({
      entries: ids.slice(at, next).map(entry),
      nextCursor: String(next),
      atEnd: next === ids.length,
      hasEarlier: at > 0,
      redactions: 1,
    });
  };
  return { read, asked };
}

describe('readWholeTranscript', () => {
  // The regression: a reader started at the latest turns and could only read
  // on, so everything before its first page was out of reach.
  it('reads every entry once, from the first to the last, starting at the conversation’s start', async () => {
    const ids = Array.from({ length: 23 }, (_, i) => `e${i}`);
    const { read, asked } = host(ids, 5);
    const { whole } = await readWholeTranscript(read, 5, 0);
    expect(whole.entries.map((each) => each.id)).toEqual(ids);
    expect(asked[0]).toEqual({ limit: 5, from: 'start' });
    expect(whole).toMatchObject({
      atEnd: true,
      hasEarlier: false,
      redactions: 5,
      nextCursor: '23',
    });
  });

  it('keeps only the new conversation when the one being read is replaced, and says so', async () => {
    let calls = 0;
    const read: TranscriptPageReader = async () => {
      calls += 1;
      if (calls === 1) return page({ entries: [entry('old')], nextCursor: 'a' });
      return page({ entries: [entry('new')], nextCursor: 'b', atEnd: true, restarted: true });
    };
    const { whole } = await readWholeTranscript(read, 5, 0);
    expect(whole.entries.map((each) => each.id)).toEqual(['new']);
    expect(whole.restarted).toBe(true);
  });

  it('stops at a page it could not read, keeping what it had and saying why', async () => {
    let calls = 0;
    const read: TranscriptPageReader = async () => {
      calls += 1;
      return calls === 1
        ? page({ entries: [entry('e0')], nextCursor: 'a' })
        : page({ status: 'unavailable', reason: 'host_offline' });
    };
    const { whole } = await readWholeTranscript(read, 5, 0);
    expect(whole).toMatchObject({ status: 'unavailable', reason: 'host_offline', atEnd: false });
    expect(whole.entries.map((each) => each.id)).toEqual(['e0']);
  });

  // The regression: a walk past the endpoint's rate limit threw on the read
  // that was refused and printed none of the pages it had already read.
  it('keeps what it read, with the cursor to read on, when a read after the first throws', async () => {
    const refused = new Error('RATE_001: Too many requests');
    let calls = 0;
    const read: TranscriptPageReader = async () => {
      calls += 1;
      if (calls === 1) return page({ entries: [entry('e0')], nextCursor: 'a' });
      if (calls === 2) return page({ entries: [entry('e1')], nextCursor: 'b' });
      throw refused;
    };
    const { whole, stoppedBy } = await readWholeTranscript(read, 5, 0);
    expect(stoppedBy).toBe(refused);
    expect(whole.entries.map((each) => each.id)).toEqual(['e0', 'e1']);
    expect(whole).toMatchObject({ nextCursor: 'b', atEnd: false });
  });

  it('calls the whole partial when any page was', async () => {
    let calls = 0;
    const read: TranscriptPageReader = async () => {
      calls += 1;
      return calls === 1
        ? page({ entries: [entry('e0')], nextCursor: 'a', status: 'partial', dropped: 1 })
        : page({ entries: [entry('e1')], nextCursor: 'b', atEnd: true });
    };
    const { whole } = await readWholeTranscript(read, 5, 0);
    expect(whole).toMatchObject({ status: 'partial', dropped: 1 });
  });
});

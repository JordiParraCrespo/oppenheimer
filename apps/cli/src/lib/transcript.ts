import type { SessionTranscriptPage } from './api-types';

/** Reads one page of a session's conversation (`GET /sessions/{id}/transcript`). */
export type TranscriptPageReader = (query: {
  cursor?: string;
  limit: number;
  from?: 'latest' | 'start';
}) => Promise<SessionTranscriptPage>;

/**
 * At most this many pages in one walk: at 200 entries a page, 100 000
 * entries, past any real conversation; a host that kept answering "more"
 * would otherwise hold the walk for good.
 */
export const TRANSCRIPT_WALK_MAX_PAGES = 500;

/**
 * A session's whole conversation, from its first entry to the last the agent
 * has written, read a page at a time from the start and on with each page's
 * `nextCursor`. The answer is one page that covers all of it: its entries in
 * order, the least complete status any page had, the drops and redactions
 * summed, and the last page's cursor to read what follows later. A page
 * that comes back `restarted` means the conversation was replaced while it
 * was read, so the walk keeps the new one only and says so. A page that could
 * not be read ends the walk with that page's reason.
 */
export async function readWholeTranscript(
  read: TranscriptPageReader,
  limit: number,
): Promise<SessionTranscriptPage> {
  let page = await read({ limit, from: 'start' });
  if (page.status === 'unsupported' || page.status === 'unavailable') return page;
  let whole: SessionTranscriptPage = { ...page, entries: [...page.entries] };
  for (
    let pages = 1;
    !page.atEnd && page.nextCursor && pages < TRANSCRIPT_WALK_MAX_PAGES;
    pages++
  ) {
    const cursor = page.nextCursor;
    page = await read({ cursor, limit });
    if (page.status === 'unsupported' || page.status === 'unavailable') {
      return {
        ...whole,
        status: page.status,
        reason: page.reason,
        detail: page.detail,
        atEnd: false,
      };
    }
    if (page.restarted) {
      whole = { ...page, entries: [...page.entries] };
      continue;
    }
    whole = {
      ...whole,
      entries: [...whole.entries, ...page.entries],
      status: whole.status === 'partial' || page.status === 'partial' ? 'partial' : 'complete',
      dropped: whole.dropped + page.dropped,
      redactions: whole.redactions + page.redactions,
      nextCursor: page.nextCursor ?? whole.nextCursor,
      atEnd: page.atEnd,
    };
    if (page.nextCursor === cursor && page.entries.length === 0) break;
  }
  return whole;
}

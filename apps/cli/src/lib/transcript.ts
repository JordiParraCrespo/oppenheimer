import type { SessionTranscriptFrom } from '@oppenheimer/shared/schemas/session-transcript';
import type { SessionTranscriptPage } from './api-types';

/** Reads one page of a session's conversation (`GET /sessions/{id}/transcript`). */
export type TranscriptPageReader = (query: {
  cursor?: string;
  limit: number;
  from?: SessionTranscriptFrom;
}) => Promise<SessionTranscriptPage>;

/**
 * At most this many pages in one walk: at 200 entries a page, 100 000
 * entries, past any real conversation; a host that kept answering "more"
 * would otherwise hold the walk for good.
 */
export const TRANSCRIPT_WALK_MAX_PAGES = 500;

/**
 * The gap between two pages of a walk: the endpoint takes 60 reads a minute
 * per credential, so a walk keeps under it and leaves room for the
 * credential's other readers.
 */
export const TRANSCRIPT_WALK_PAGE_GAP_MS = 1_500;

export interface TranscriptWalk {
  /** Everything read, as one page. */
  whole: SessionTranscriptPage;
  /** The error a read after the first threw, which ended the walk early; `whole.nextCursor` reads on. */
  stoppedBy: unknown;
}

/**
 * A session's whole conversation, from its first entry to the last the agent
 * has written, read a page at a time from the start and on with each page's
 * `nextCursor`, `gapMs` apart. The answer is one page that covers all of it:
 * its entries in order, the least complete status any page had, the drops and
 * redactions summed, and the last page's cursor to read on later. A page
 * that comes back `restarted` means the conversation was replaced while it
 * was read, so the walk keeps the new one only and says so. A page that
 * could not be read ends the walk with that page's reason; a read that
 * throws after the first (a rate limit, the network) ends it with what it
 * had, the error in `stoppedBy`.
 */
export async function readWholeTranscript(
  read: TranscriptPageReader,
  limit: number,
  gapMs: number,
): Promise<TranscriptWalk> {
  let page = await read({ limit, from: 'start' });
  let whole: SessionTranscriptPage = { ...page, entries: [...page.entries] };
  if (page.status === 'unsupported' || page.status === 'unavailable') {
    return { whole, stoppedBy: null };
  }
  for (
    let pages = 1;
    !page.atEnd && page.nextCursor && pages < TRANSCRIPT_WALK_MAX_PAGES;
    pages++
  ) {
    const cursor = page.nextCursor;
    if (gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    try {
      page = await read({ cursor, limit });
    } catch (error) {
      return { whole: { ...whole, atEnd: false }, stoppedBy: error };
    }
    if (page.status === 'unsupported' || page.status === 'unavailable') {
      return {
        whole: {
          ...whole,
          status: page.status,
          reason: page.reason,
          detail: page.detail,
          atEnd: false,
        },
        stoppedBy: null,
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
  return { whole, stoppedBy: null };
}

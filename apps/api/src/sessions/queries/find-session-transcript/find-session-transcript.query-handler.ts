import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionTranscriptPage } from '@oppenheimer/shared';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type {
  HostTranscriptRequest,
  SessionTranscriptPort,
} from '../../application/session-transcript.port';
import {
  decodeTranscriptCursor,
  encodeTranscriptCursor,
  redactEntry,
  transcriptPageStatus,
  transcriptReasonStatus,
  transcriptRefusalReason,
} from '../../domain/session-transcript.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SessionTranscriptMapper } from '../../session-transcript.mapper';
import { SESSION_TRANSCRIPT } from '../../sessions.di-tokens';
import { FindSessionTranscriptQuery } from './find-session-transcript.query';

/**
 * A page of a session's conversation (`product/next-steps/agent-tools.md`
 * §8). The session is read first, in the caller's scope, and that read is the
 * authorization: one outside it is not found, whatever the cursor says. A
 * cloud session's conversation is at its vendor, which no supported API reads
 * for us, so it is `unsupported` with the vendor's link and its host is never
 * asked. Anything else is asked of the host live, and what comes back is
 * narrowed, has its secrets taken out, and says how complete it is.
 */
@QueryHandler(FindSessionTranscriptQuery)
export class FindSessionTranscriptQueryHandler
  implements IQueryHandler<FindSessionTranscriptQuery, SessionTranscriptPage>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_TRANSCRIPT)
    private readonly transcripts: SessionTranscriptPort,
  ) {}

  async execute(query: FindSessionTranscriptQuery): Promise<SessionTranscriptPage> {
    const session = await this.loader.find(query.scope, query.sessionId);
    if (session.place === 'cloud' || session.hostId === null) {
      return SessionTranscriptMapper.unread('unsupported', 'cloud_vendor', {
        vendorUrl: session.vendorUrl,
      });
    }
    const outcome = await this.transcripts.read(
      session.hostId,
      session.id,
      requestOf(query.cursor, query.limit),
    );
    switch (outcome.kind) {
      case 'page': {
        const { page } = outcome;
        const redacted = SessionTranscriptMapper.toEntries(page.entries).map(redactEntry);
        const entries = redacted.map((each) => each.entry);
        return SessionTranscriptMapper.toPage(page, {
          entries,
          status: transcriptPageStatus({
            entries,
            dropped: page.dropped ?? 0,
            partial: page.partial ?? false,
          }),
          redactions: redacted.reduce((sum, each) => sum + each.redactions, 0),
          nextCursor: page.conversation
            ? encodeTranscriptCursor({ conversation: page.conversation, after: page.next })
            : null,
        });
      }
      case 'host_offline':
      case 'timed_out':
        return SessionTranscriptMapper.unread('unavailable', outcome.kind);
      case 'not_supported':
        return SessionTranscriptMapper.unread('unsupported', 'runner_too_old');
      case 'failed': {
        const reason = transcriptRefusalReason(outcome.code);
        return SessionTranscriptMapper.unread(transcriptReasonStatus(reason), reason, {
          detail: outcome.code,
        });
      }
    }
  }
}

/** The host's request for a cursor, or the refusal of one this API did not mint. */
function requestOf(cursor: string | undefined, limit: number): HostTranscriptRequest {
  if (cursor === undefined) return { limit };
  const decoded = decodeTranscriptCursor(cursor);
  if (!decoded) {
    throw new AppError(SessionErrors.TRANSCRIPT_CURSOR_INVALID, {
      detail: 'Read from the latest turns (no cursor) and continue from the nextCursor it gives.',
    });
  }
  return { limit, ...decoded };
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionTranscriptFrom } from '@oppenheimer/shared';

/** A page of a session's conversation, read off its host now. */
export class FindSessionTranscriptQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** Where the last page ended, as this API minted it; absent for the latest turns. */
  readonly cursor?: string;
  readonly limit: number;
  /** Without a cursor, where the read starts: the latest turns, or the conversation's first line. */
  readonly from: SessionTranscriptFrom;

  constructor(props: {
    scope: AccessScope;
    sessionId: string;
    cursor?: string;
    limit: number;
    from?: SessionTranscriptFrom;
  }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.cursor = props.cursor;
    this.limit = props.limit;
    this.from = props.from ?? 'latest';
  }
}

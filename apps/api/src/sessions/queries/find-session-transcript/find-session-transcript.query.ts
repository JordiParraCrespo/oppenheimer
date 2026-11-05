import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** A page of a session's conversation, read off its host now. */
export class FindSessionTranscriptQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** Where the last page ended, as this API minted it; absent for the latest turns. */
  readonly cursor?: string;
  readonly limit: number;

  constructor(props: { scope: AccessScope; sessionId: string; cursor?: string; limit: number }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.cursor = props.cursor;
    this.limit = props.limit;
  }
}

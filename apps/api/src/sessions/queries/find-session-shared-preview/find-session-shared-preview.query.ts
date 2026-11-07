import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionSharedFile } from '@oppenheimer/shared';

/**
 * What a bot's `show_session_file` reads: the file as the session keeps it
 * and its JPEG preview from the host, or why there is none. Each reason is an
 * answer the tool words for the model, not a failure.
 */
export type SessionSharedPreviewRead =
  | { kind: 'preview'; file: SessionSharedFile; mediaType: 'image/jpeg'; data: string }
  | { kind: 'unknown_file' }
  | { kind: 'no_preview'; file: SessionSharedFile }
  | { kind: 'host_offline' | 'not_supported' | 'timed_out'; file: SessionSharedFile }
  | { kind: 'gone'; file: SessionSharedFile; code: string };

/** The preview of a file a session's agent shared, asked of its host now. */
export class FindSessionSharedPreviewQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly fileId: string;

  constructor(props: { scope: AccessScope; sessionId: string; fileId: string }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.fileId = props.fileId;
  }
}

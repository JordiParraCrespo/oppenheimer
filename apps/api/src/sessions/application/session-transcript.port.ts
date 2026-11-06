import type { TranscriptPageMessage } from '@oppenheimer/shared/protocol';

/** One page as its runner read it (`transcript.page` without its envelope). */
export type HostTranscriptPage = Omit<TranscriptPageMessage, 'type' | 'commandId'>;

/** Where to read from: the conversation's tail, or on from a page already read. */
export type HostTranscriptRequest =
  | { limit: number }
  | { limit: number; conversation: string; after: number };

/**
 * What asking a session's host for a page of its conversation came back
 * with: the page, the reason nothing was asked (no link, or a runner too old
 * to answer), no answer in time, or the runner's refusal with its catalog code
 * (`SESS_001` the session is not on that host, `SESS_018` its agent keeps no
 * transcript the runner reads).
 */
export type SessionTranscriptOutcome =
  | { kind: 'page'; page: HostTranscriptPage }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a reader with no
 * browser attached can read a session's conversation
 * (`product/next-steps/agent-tools.md` §8). The conversation lives on the
 * host; like `SessionSharedFilesPort` it waits for the runner's answer, and
 * nothing is cached.
 */
export interface SessionTranscriptPort {
  read(
    hostId: string,
    sessionId: string,
    request: HostTranscriptRequest,
  ): Promise<SessionTranscriptOutcome>;
}

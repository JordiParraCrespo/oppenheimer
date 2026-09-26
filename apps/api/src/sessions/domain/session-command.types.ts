import type { AggregateID } from '@oppenheimer/backend-ddd';

/**
 * What a command that talks to a host answers with.
 *
 * The id of the session it changed, and `hints`: what the control plane could not
 * do for this request — `host_offline` when the command was recorded but no link
 * exists, so the work is owed. The controller reads the session back with
 * `FindSessionQuery`, as every command does; `hints` rides beside the id because
 * no query can read it back. It is about this request, not a log entry: "we could
 * not reach the host just now" is not part of the session's history.
 */
export interface SessionCommandResult {
  sessionId: AggregateID;
  hints: string[];
}

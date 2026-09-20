import type { WorkSessionEntity } from './work-session.entity';

/**
 * What a command that talks to a host answers with.
 *
 * The session is the row as the append left it; `hints` is what the control plane
 * could not do for this request — `host_offline` when the command was recorded but
 * no link exists, so the work is owed. It travels with the session rather than in
 * a second envelope because the console renders the row it just changed, and it is
 * a *response* field rather than a log entry because "we could not reach the host
 * just now" is about this request, not about the session's history.
 */
export interface SessionCommandResult {
  session: WorkSessionEntity;
  hints: string[];
}

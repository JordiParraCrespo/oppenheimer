import { cloudSessionIdPattern } from './cloud-id';
import type { TrackedSession } from './session';
import type { OppenheimerConnection } from './store';
import type { TrackedSessions } from './tracker';

/** `POST /sessions/cloud-status`'s body: every tracked session, by its Claude Code id. */
export function reportBody(sessions: TrackedSessions) {
  return {
    sessions: Object.values(sessions)
      .filter((session) => cloudSessionIdPattern.test(session.id))
      .slice(0, 200)
      .map((session: TrackedSession) => ({ cloudSessionId: session.id, state: session.state })),
  };
}

/** The API's route for it, from the origin the person connected. */
export function reportUrl(connection: OppenheimerConnection) {
  return `${new URL(connection.apiUrl).origin}/api/v1/sessions/cloud-status`;
}

/**
 * Sends the report. Answers how many of the sessions the workspace launched,
 * or throws with what the API said.
 */
export async function sendReport(
  connection: OppenheimerConnection,
  sessions: TrackedSessions,
): Promise<number> {
  const response = await fetch(reportUrl(connection), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
    body: JSON.stringify(reportBody(sessions)),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { title?: string } | null;
    throw new Error(`${response.status} ${problem?.title ?? response.statusText}`.trim());
  }
  const { matched } = (await response.json()) as { matched: number };
  return matched;
}

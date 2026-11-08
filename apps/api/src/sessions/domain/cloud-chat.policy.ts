import type { WorkSessionEntity } from './work-session.entity';

/**
 * Whether a session's chat is kept here: a Claude Code cloud session the
 * console launched and its host started, whose hooks send its transcript and
 * collect replies (`product/next-steps/cloud-agents.md`, "The chat of a cloud
 * session"). Codex and Cursor keep theirs at their vendor.
 */
export function hasCloudChat(
  session: Pick<WorkSessionEntity, 'place' | 'agent' | 'cloudSessionId'>,
): boolean {
  return (
    session.place === 'cloud' && session.agent === 'claude-code' && session.cloudSessionId !== null
  );
}

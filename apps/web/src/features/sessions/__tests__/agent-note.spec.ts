import { SessionEntity } from '@oppenheimer/frontend-consumer';
import type { SessionAgentReport } from '@oppenheimer/shared/schemas/session-agent-report';
import { describe, expect, it } from 'vitest';
import { agentNoteFor } from '../lib/session-run-state';

function session(
  agentReport: SessionAgentReport | null,
  lifecycle: SessionEntity['lifecycle'] = 'open',
) {
  return new SessionEntity({
    id: 's-1',
    organizationId: 'org-1',
    projectId: 'p-1',
    hostId: 'h-1',
    name: 'Fix the list',
    slug: 'bold-otter',
    agent: 'claude-code',
    launch: { model: null, permission: null, effort: null },
    state: 'waiting-on-you',
    lifecycle,
    cwdCheckoutId: null,
    checkouts: [],
    stoppedAt: null,
    hints: [],
    createdAt: new Date('2026-10-01T00:00:00Z'),
    place: 'worktree',
    folderPath: null,
    agentReport,
  });
}

const report = (fields: Partial<SessionAgentReport>): SessionAgentReport => ({
  state: 'working',
  kind: null,
  progress: null,
  message: null,
  title: null,
  ...fields,
});

/**
 * The session bar's note is the agent's own word (OSC 7501) after the state:
 * why it waits and what it says. It must never put a guess in the agent's
 * mouth, so a state read off the screen draws nothing.
 */
describe('the agent’s note in the session bar', () => {
  it('says why a blocked agent waits, with its message', () => {
    expect(
      agentNoteFor(
        session(
          report({ state: 'blocked', kind: 'permission', message: 'approve Bash: pnpm test' }),
        ),
      ),
    ).toEqual({ word: 'permission', message: 'approve Bash: pnpm test' });
  });

  it('says a turn ended in an error, which the dot shows as done', () => {
    expect(agentNoteFor(session(report({ state: 'error', message: 'overloaded' })))).toEqual({
      word: 'error',
      message: 'overloaded',
    });
  });

  it('draws nothing when the screen spoke, the agent said nothing, or the session is down', () => {
    expect(agentNoteFor(session(null))).toBeNull();
    expect(agentNoteFor(session(report({ state: 'working' })))).toBeNull();
    expect(
      agentNoteFor(session(report({ state: 'blocked', kind: 'question' }), 'failed')),
    ).toBeNull();
  });
});

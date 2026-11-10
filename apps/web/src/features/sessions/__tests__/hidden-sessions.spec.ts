import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { listedSessions } from '../lib/hidden-sessions';

/**
 * A session a bot started hidden stays out of the sidebar until the reader
 * shows hidden sessions, and the filter menu still counts it, so it is never
 * lost.
 */
describe('listedSessions', () => {
  const session = (id: string, hidden: boolean) => ({ id, hidden }) as SessionEntity;
  const sessions = [session('shown', false), session('bot', true)];

  it('leaves hidden sessions out until they are shown, counting them either way', () => {
    const hiding = listedSessions(sessions, false);
    expect(hiding.sessions.map(({ id }) => id)).toEqual(['shown']);
    expect(hiding.hiddenCount).toBe(1);

    const showing = listedSessions(sessions, true);
    expect(showing.sessions.map(({ id }) => id)).toEqual(['shown', 'bot']);
    expect(showing.hiddenCount).toBe(1);
  });
});

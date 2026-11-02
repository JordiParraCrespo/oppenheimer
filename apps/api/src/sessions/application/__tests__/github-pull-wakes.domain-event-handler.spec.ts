import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { GithubPullWakesDomainEventHandler } from '../event-handlers/github-pull-wakes.domain-event-handler';
import type { SessionWakesPort } from '../session-wakes.port';

/**
 * A GitHub event on a pull request wakes each open session in its workspace
 * that watches that pull request, once per stored event; anything else wakes
 * nobody.
 */

function harness(watching: string[]) {
  const sessions = {
    findWatchingPullForSystem: vi
      .fn()
      .mockResolvedValue(watching.map((id) => ({ id }) as WorkSessionEntity)),
  } as unknown as WorkSessionRepositoryPort;
  const wakes = { schedule: vi.fn().mockResolvedValue(undefined) } as unknown as SessionWakesPort;
  return { handler: new GithubPullWakesDomainEventHandler(sessions, wakes), sessions, wakes };
}

const event = (overrides: Record<string, unknown> = {}) => ({
  aggregateId: 'evt-1',
  organizationId: 'org-acme',
  source: 'github',
  eventType: 'check_failed',
  subjectRef: '821374923',
  actorLogin: 'github-actions[bot]',
  actorIsOwnApp: false,
  attributes: { number: 128, conclusion: 'failure', check: 'GitHub Actions' },
  metadata: { correlationId: 'corr-1', timestamp: Date.now() },
  ...overrides,
});

describe('GithubPullWakesDomainEventHandler', () => {
  it('wakes every session watching the pull request, keyed by the event', async () => {
    const { handler, sessions, wakes } = harness(['s-1', 's-2']);
    await handler.handle(event());
    expect(sessions.findWatchingPullForSystem).toHaveBeenCalledWith('org-acme', '821374923', 128);
    const scheduled = vi.mocked(wakes.schedule).mock.calls.map(([wake]) => wake);
    expect(scheduled).toEqual([
      expect.objectContaining({
        sessionId: 's-1',
        wakeId: 'gh-evt-1',
        source: 'github',
        attempt: 0,
      }),
      expect.objectContaining({ sessionId: 's-2', wakeId: 'gh-evt-1' }),
    ]);
    expect(scheduled[0]?.text).toContain('Pull request #128: checks failed (GitHub Actions)');
  });

  it('wakes nobody for our own app, an event that names no pull request, or one that is not a wake', async () => {
    for (const quiet of [
      event({ actorIsOwnApp: true }),
      event({ attributes: { conclusion: 'failure', number: null } }),
      event({ eventType: 'push' }),
      event({ source: 'gmail' }),
    ]) {
      const { handler, sessions, wakes } = harness(['s-1']);
      await handler.handle(quiet);
      expect(sessions.findWatchingPullForSystem).not.toHaveBeenCalled();
      expect(wakes.schedule).not.toHaveBeenCalled();
    }
  });
});

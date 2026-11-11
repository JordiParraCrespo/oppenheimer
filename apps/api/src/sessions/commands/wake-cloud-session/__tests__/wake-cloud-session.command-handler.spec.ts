import { CLOUD_REPLY_PREAMBLE } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { HostClaudeAccountsPort } from '../../../../hosts/application/host-claude-accounts.port';
import type {
  CloudSessionReplyOutcome,
  CloudSessionReplyPort,
} from '../../../application/cloud-session-reply.port';
import type {
  CloudChatReply,
  SessionCloudChatRepositoryPort,
} from '../../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { WakeCloudSessionCommand } from '../wake-cloud-session.command';
import { WakeCloudSessionCommandHandler } from '../wake-cloud-session.command-handler';

/**
 * A reply the Stop hook did not take is sent from a host on the session's
 * claude.ai account, so it wakes the session: claimed first, so it never goes
 * twice; handed back to the hook when it certainly did not go; kept when it
 * may have. The claim itself, and its race with the hook, is
 * `session-cloud-chat.integration.spec.ts`.
 */

const CLOUD_ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';

function cloudSession(overrides: Partial<Parameters<typeof WorkSessionEntity.request>[0]> = {}) {
  const session = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    place: 'cloud',
    ...overrides,
  });
  session.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.STARTED,
    payload: { agentSessionId: CLOUD_ID, checkouts: [] },
    occurredAt: new Date(),
  });
  return session;
}

const reply: CloudChatReply = {
  id: 'reply-1',
  authorId: 'user-1',
  text: 'Now tag the release',
  createdAt: new Date(),
  collectedAt: new Date(),
  deliveredVia: 'host',
};

function harness(
  found: WorkSessionEntity | null,
  {
    hosts = ['host-1', 'host-2'],
    claimed = reply as CloudChatReply | null,
    outcome = { kind: 'sent', hostId: 'host-1' } as CloudSessionReplyOutcome,
  } = {},
) {
  const sessions = {
    findOneByIdForMachine: vi.fn().mockResolvedValue(found ? Some(found) : None),
  } satisfies Pick<WorkSessionRepositoryPort, 'findOneByIdForMachine'>;
  const chat = {
    claimReplyForHost: vi.fn().mockResolvedValue(claimed),
    releaseHostClaim: vi.fn().mockResolvedValue(undefined),
  } satisfies Pick<SessionCloudChatRepositoryPort, 'claimReplyForHost' | 'releaseHostClaim'>;
  const accounts = {
    signedInLike: vi.fn().mockResolvedValue(hosts),
  } satisfies HostClaudeAccountsPort;
  const replies = { send: vi.fn().mockResolvedValue(outcome) } satisfies CloudSessionReplyPort;
  const handler = new WakeCloudSessionCommandHandler(
    sessions as unknown as WorkSessionRepositoryPort,
    chat as unknown as SessionCloudChatRepositoryPort,
    accounts,
    replies,
  );
  const run = () =>
    handler.execute(
      new WakeCloudSessionCommand({ wake: { sessionId: 's-1', replyId: 'reply-1' } }),
    );
  return { run, chat, accounts, replies };
}

describe('waking a cloud session with a reply', () => {
  it('sends the reply as the hook would, from the hosts on the launching host’s account', async () => {
    const { run, accounts, replies, chat } = harness(cloudSession());
    await expect(run()).resolves.toBe('sent');
    expect(accounts.signedInLike).toHaveBeenCalledWith('host-1', 'user-1');
    expect(replies.send).toHaveBeenCalledWith(
      ['host-1', 'host-2'],
      CLOUD_ID,
      `${CLOUD_REPLY_PREAMBLE}\n\nNow tag the release`,
    );
    expect(chat.releaseHostClaim).not.toHaveBeenCalled();
  });

  it('sends nothing for a reply the hook already took', async () => {
    const { run, replies } = harness(cloudSession(), { claimed: null });
    await expect(run()).resolves.toBe('taken');
    expect(replies.send).not.toHaveBeenCalled();
  });

  it('claims nothing when no host is on the session’s account', async () => {
    const { run, chat, replies } = harness(cloudSession(), { hosts: [] });
    await expect(run()).resolves.toBe('no_account');
    expect(chat.claimReplyForHost).not.toHaveBeenCalled();
    expect(replies.send).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'no_host' } as const,
    { kind: 'refused', hostId: 'host-1', code: 'SESS_020', detail: 'Session not found' } as const,
  ])('hands the reply back to the hook when it certainly did not go ($kind)', async (outcome) => {
    const { run, chat } = harness(cloudSession(), { outcome });
    await expect(run()).resolves.toBe(outcome.kind);
    expect(chat.releaseHostClaim).toHaveBeenCalledWith('s-1', 'reply-1');
  });

  it('keeps the claim on a send that may have gone, so the hook never delivers it again', async () => {
    const { run, chat } = harness(cloudSession(), {
      outcome: { kind: 'unconfirmed', hostId: 'host-1', code: 'SESS_021' },
    });
    await expect(run()).resolves.toBe('unconfirmed');
    expect(chat.releaseHostClaim).not.toHaveBeenCalled();
  });

  it('does nothing for a session that is gone or keeps no cloud chat', async () => {
    for (const found of [null, cloudSession({ agent: 'codex' })]) {
      const { run, chat, replies } = harness(found);
      await expect(run()).resolves.toBe('no_session');
      expect(chat.claimReplyForHost).not.toHaveBeenCalled();
      expect(replies.send).not.toHaveBeenCalled();
    }
  });
});

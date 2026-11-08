import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it } from 'vitest';
import { CloudReplyWakeResolver } from '../application/cloud-reply-wake.resolver';
import type {
  SessionCloudPromptOutcome,
  SessionCloudPromptPort,
} from '../application/session-cloud-prompt.port';
import { CollectCloudReplyCommand } from '../commands/collect-cloud-reply/collect-cloud-reply.command';
import { CollectCloudReplyCommandHandler } from '../commands/collect-cloud-reply/collect-cloud-reply.command-handler';
import type {
  CloudChatReply,
  SessionCloudChatRepositoryPort,
} from '../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';

const session = {
  id: '6f1c2b0e-0000-4000-8000-000000000001',
  organizationId: '6f1c2b0e-0000-4000-8000-0000000000aa',
  hostId: '6f1c2b0e-0000-4000-8000-0000000000bb',
  cloudSessionId: 'session_014a8EH8DJs95X1iK8ZH9Y82',
  place: 'cloud' as const,
  agent: 'claude-code' as const,
};

/** The chat's two tables as the repository keeps them, in memory. */
class MemoryChat
  implements
    Pick<
      SessionCloudChatRepositoryPort,
      'collectReply' | 'claimReply' | 'releaseReply' | 'markListening' | 'markIdle' | 'claimIdle'
    >
{
  replies: CloudChatReply[] = [];
  idle = false;
  add(text: string): CloudChatReply {
    const reply = {
      id: `reply-${this.replies.length + 1}`,
      authorId: null,
      text,
      createdAt: new Date(),
      collectedAt: null,
    };
    this.replies.push(reply);
    return reply;
  }

  waiting(): string[] {
    return this.replies.filter((reply) => reply.collectedAt === null).map((reply) => reply.text);
  }

  async collectReply(): Promise<CloudChatReply | null> {
    const reply = this.replies.find((r) => r.collectedAt === null) ?? null;
    if (reply) reply.collectedAt = new Date();
    return reply;
  }

  async claimReply(_sessionId: string, replyId: string): Promise<boolean> {
    const reply = this.replies.find((r) => r.id === replyId && r.collectedAt === null);
    if (reply) reply.collectedAt = new Date();
    return reply !== undefined;
  }

  async releaseReply(_sessionId: string, replyId: string): Promise<void> {
    const reply = this.replies.find((r) => r.id === replyId);
    if (reply) reply.collectedAt = null;
  }

  async markListening(): Promise<void> {
    this.idle = false;
  }

  async markIdle(): Promise<void> {
    this.idle = true;
  }

  async claimIdle(): Promise<boolean> {
    const was = this.idle;
    this.idle = false;
    return was;
  }
}

/** The host as the link answers: what it was asked to send, and how it answers. */
class FakeHost implements SessionCloudPromptPort {
  sent: { hostId: string; cloudSessionId: string; text: string }[] = [];
  constructor(private answer: SessionCloudPromptOutcome = { kind: 'sent' }) {}

  answers(answer: SessionCloudPromptOutcome): void {
    this.answer = answer;
  }

  async send(hostId: string, _sessionId: string, cloudSessionId: string, text: string) {
    this.sent.push({ hostId, cloudSessionId, text });
    return this.answer;
  }
}

function setUp(answer?: SessionCloudPromptOutcome) {
  const chat = new MemoryChat();
  const host = new FakeHost(answer);
  const repository = chat as unknown as SessionCloudChatRepositoryPort;
  const waker = new CloudReplyWakeResolver(repository, host);
  const sessions = {
    findCloudByCloudIds: async () => [session],
  } as unknown as WorkSessionRepositoryPort;
  const hook = new CollectCloudReplyCommandHandler(sessions, repository);
  /** The session's Stop hook asking, with no wait. */
  const stopHook = () =>
    hook.execute(
      new CollectCloudReplyCommand({
        scope: {} as AccessScope,
        cloudSessionId: session.cloudSessionId,
        waitSeconds: 0,
      }),
    );
  /** The person typing a reply in the console. */
  const type = (text: string) => waker.wake(session, chat.add(text));
  return { chat, host, stopHook, type };
}

/**
 * A reply typed in a cloud session's chat after its Stop hook stopped
 * waiting wakes the session from the host that started it, and reaches the
 * agent exactly once. The regressions: a reply to an idle session that waits
 * for a turn that never comes, a reply sent from the host while a hook is
 * listening (the agent gets it twice), two replies at once waking it twice,
 * and a reply the host could not send lost instead of kept for the next hook.
 */
describe('waking an idle cloud session with a reply', () => {
  it('leaves a reply for the hook while the session works or a hook listens', async () => {
    const { chat, host, type } = setUp();

    expect(await type('Use the other table')).toBe('waiting');

    expect(host.sent).toEqual([]);
    expect(chat.waiting()).toEqual(['Use the other table']);
  });

  it('sends a reply from the host once the hook gave up, and the next one waits for the woken turn', async () => {
    const { chat, host, stopHook, type } = setUp();
    expect(await stopHook()).toBeNull();

    expect(await type('Yes, add the test too')).toBe('sent');
    expect(await type('And update the docs')).toBe('waiting');

    expect(host.sent).toEqual([
      {
        hostId: session.hostId,
        cloudSessionId: session.cloudSessionId,
        text: 'Yes, add the test too',
      },
    ]);
    expect(chat.waiting()).toEqual(['And update the docs']);
    expect((await stopHook())?.text).toBe('And update the docs');
  });

  it('keeps a reply the host could not send for the next hook, and lets the next reply try again', async () => {
    const { chat, host, stopHook, type } = setUp({ kind: 'failed', code: 'SESS_019' });
    await stopHook();

    expect(await type('Ship it')).toBe('returned');
    expect(chat.waiting()).toEqual(['Ship it']);

    host.answers({ kind: 'host_offline' });
    expect(await type('Ship it now')).toBe('returned');
    expect(host.sent).toHaveLength(2);
    expect(chat.waiting()).toEqual(['Ship it', 'Ship it now']);
  });

  it('does not send again a reply the host may have delivered', async () => {
    const { chat, stopHook, type } = setUp({ kind: 'timed_out' });
    await stopHook();

    expect(await type('Ship it')).toBe('unknown');

    expect(chat.waiting()).toEqual([]);
    expect(await stopHook()).toBeNull();
  });

  it('hands the hook a reply typed as its wait ends, and leaves the session working', async () => {
    const { chat, host, stopHook, type } = setUp();
    // The first look finds nothing; the reply lands before the last one.
    const first = chat.collectReply.bind(chat);
    let looks = 0;
    chat.collectReply = async () => {
      looks += 1;
      if (looks === 2) chat.add('Just in time');
      return first();
    };

    expect((await stopHook())?.text).toBe('Just in time');
    expect(chat.idle).toBe(false);
    expect(await type('Next')).toBe('waiting');
    expect(host.sent).toEqual([]);
  });
});

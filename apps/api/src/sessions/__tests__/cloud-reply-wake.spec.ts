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

/**
 * The chat's tables as the repository keeps them, in memory. A stale wake
 * (a claim past `STALE_WAKE_SECONDS`) is the SQL's, proven in
 * `session-cloud-chat.integration.spec.ts`.
 */
class MemoryChat
  implements
    Pick<
      SessionCloudChatRepositoryPort,
      | 'collectReply'
      | 'claimWaiting'
      | 'releaseReplies'
      | 'markListening'
      | 'markIdle'
      | 'claimIdle'
    >
{
  replies: CloudChatReply[] = [];
  idle = false;

  add(text: string): CloudChatReply {
    const reply = {
      id: `reply-${this.replies.length + 1}`,
      authorId: null,
      text,
      createdAt: new Date(Date.now() + this.replies.length),
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

  async claimWaiting(): Promise<CloudChatReply[]> {
    const waiting = this.replies.filter((r) => r.collectedAt === null);
    for (const reply of waiting) reply.collectedAt = new Date();
    return waiting;
  }

  async releaseReplies(_sessionId: string, replyIds: readonly string[]): Promise<void> {
    for (const reply of this.replies) if (replyIds.includes(reply.id)) reply.collectedAt = null;
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

function setUp(answer?: SessionCloudPromptOutcome, chat = new MemoryChat()) {
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
  /** The person typing a reply in the console, as the send handler hands it on. */
  const type = (text: string) => {
    chat.add(text);
    return waker.wake(session);
  };
  const texts = () => host.sent.map((sent) => sent.text);
  return { chat, host, stopHook, type, texts };
}

/**
 * A reply typed in a cloud session's chat after its Stop hook stopped
 * waiting wakes the session from the host that started it, and reaches the
 * agent exactly once and in order. The regressions: a reply to an idle
 * session that waits for a turn that never comes; a reply sent from the host
 * while a hook is listening (the agent gets it twice); two replies at once
 * waking it twice; a reply the host could not send lost, or overtaken by the
 * next one; one the host may have delivered handed to the next hook as well;
 * and a session left unwakeable after the host did not answer.
 */
describe('waking an idle cloud session with a reply', () => {
  it('leaves a reply for the hook while the session works or a hook listens', async () => {
    const { chat, texts, type } = setUp();

    expect(await type('Use the other table')).toBe('waiting');

    expect(texts()).toEqual([]);
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

  it('keeps replies the host could not send, and sends them first with the next one', async () => {
    const { chat, host, stopHook, texts, type } = setUp({ kind: 'failed', code: 'SESS_019' });
    await stopHook();

    expect(await type('Ship it')).toBe('returned');
    expect(chat.waiting()).toEqual(['Ship it']);
    host.answers({ kind: 'host_offline' });
    expect(await type('Then tag it')).toBe('returned');
    expect(chat.waiting()).toEqual(['Ship it', 'Then tag it']);

    host.answers({ kind: 'sent' });
    expect(await type('And tell me')).toBe('sent');
    expect(texts().at(-1)).toBe('Ship it\n\nThen tag it\n\nAnd tell me');
    expect(chat.waiting()).toEqual([]);
  });

  it('does not send again what the host may have delivered, and can still wake the session', async () => {
    const { chat, stopHook, texts, type } = setUp({ kind: 'timed_out' });
    await stopHook();

    expect(await type('Ship it')).toBe('unknown');
    expect(chat.waiting()).toEqual([]);

    expect(await type('Are you there?')).toBe('unknown');
    expect(texts()).toEqual(['Ship it', 'Are you there?']);
  });

  it('sends what fits in one message and leaves the rest for the woken turn', async () => {
    const chat = new MemoryChat();
    const long = 'x'.repeat(15_000);
    chat.add(long);
    chat.add(long);
    chat.idle = true;
    const { texts, type } = setUp({ kind: 'sent' }, chat);

    expect(await type('short')).toBe('sent');

    expect(texts()).toEqual([long]);
    expect(chat.waiting()).toEqual([long, 'short']);
  });

  it('hands the hook a reply typed as its wait ends, and leaves the session working', async () => {
    const { chat, stopHook, texts, type } = setUp();
    const first = chat.collectReply.bind(chat);
    let looks = 0;
    // The first look finds nothing; the reply lands before the last one.
    chat.collectReply = async () => {
      looks += 1;
      if (looks === 2) chat.add('Just in time');
      return first();
    };

    expect((await stopHook())?.text).toBe('Just in time');
    expect(chat.idle).toBe(false);
    expect(await type('Next')).toBe('waiting');
    expect(texts()).toEqual([]);
  });
});

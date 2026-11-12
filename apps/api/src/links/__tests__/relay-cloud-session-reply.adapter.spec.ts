import 'reflect-metadata';
import { cloudReplySchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  CLOUD_REPLY_TIMEOUT_MS,
  RelayCloudSessionReplyAdapter,
} from '../infrastructure/relay-cloud-session-reply.adapter';

/**
 * A reply that wakes a cloud session, over the runner link: sent once, to the
 * first listed host online whose runner takes `cloud.reply`, and read back as
 * sent, refused (it certainly did not go) or unconfirmed (it may have).
 */

const OLD = 'a1c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const NEW = 'b2c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const CLOUD_ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';

function linkOf(hostId: string, capabilities: RunnerCapability[]) {
  return { hostId, capabilities, send: vi.fn().mockReturnValue(true) } as unknown as RunnerLink;
}

function harness(online: RunnerLink[]) {
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn((hostId: string) => online.find((link) => link.hostId === hostId)),
  };
  const replies = new InProcessLinkReplies();
  return { replies, adapter: new RelayCloudSessionReplyAdapter(links, replies) };
}

const sentOn = (link: RunnerLink) =>
  cloudReplySchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);

describe('RelayCloudSessionReplyAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips a host whose runner predates cloud.reply and sends through the next', async () => {
    const old = linkOf(OLD, ['session.cloud']);
    const current = linkOf(NEW, ['session.cloud', 'session.cloud.reply']);
    const { adapter, replies } = harness([old, current]);

    const pending = adapter.send([OLD, NEW], CLOUD_ID, 'go');
    const sent = sentOn(current);
    expect(sent).toMatchObject({ cloudSessionId: CLOUD_ID, text: 'go' });
    expect(old.send).not.toHaveBeenCalled();
    replies.settle(NEW, { type: 'cloud.replied', commandId: sent.commandId });
    await expect(pending).resolves.toEqual({ kind: 'sent', hostId: NEW });
  });

  it('answers no_host, sending nothing, when no listed host can take it', async () => {
    const { adapter } = harness([linkOf(OLD, ['session.cloud'])]);
    await expect(adapter.send([OLD, NEW], CLOUD_ID, 'go')).resolves.toEqual({ kind: 'no_host' });
  });

  it('reads a refusal as refused, and a runner timeout as unconfirmed', async () => {
    const link = linkOf(NEW, ['session.cloud.reply']);
    const { adapter, replies } = harness([link]);

    const refused = adapter.send([NEW], CLOUD_ID, 'go');
    replies.settle(NEW, {
      type: 'command.failed',
      commandId: sentOn(link).commandId,
      code: 'SESS_020',
      detail: 'Session not found',
    });
    await expect(refused).resolves.toMatchObject({ kind: 'refused', code: 'SESS_020' });

    vi.mocked(link.send).mockClear();
    const timedOut = adapter.send([NEW], CLOUD_ID, 'go');
    replies.settle(NEW, {
      type: 'command.failed',
      commandId: sentOn(link).commandId,
      code: 'SESS_021',
    });
    await expect(timedOut).resolves.toMatchObject({ kind: 'unconfirmed', code: 'SESS_021' });
  });

  it('counts a send nobody answered as unconfirmed, never as refused', async () => {
    vi.useFakeTimers();
    const { adapter } = harness([linkOf(NEW, ['session.cloud.reply'])]);
    const pending = adapter.send([NEW], CLOUD_ID, 'go');
    await vi.advanceTimersByTimeAsync(CLOUD_REPLY_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual({ kind: 'unconfirmed', hostId: NEW });
  });
});

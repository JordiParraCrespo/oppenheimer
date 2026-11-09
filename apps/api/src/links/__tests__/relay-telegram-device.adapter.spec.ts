import 'reflect-metadata';
import {
  type RunnerCapability,
  telegramLinkSchema,
  telegramSendSchema,
} from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelayTelegramDeviceAdapter,
  TELEGRAM_LINK_REFUSAL_WINDOW_MS,
  TELEGRAM_SEND_TIMEOUT_MS,
} from '../infrastructure/relay-telegram-device.adapter';

/**
 * A host's Telegram bot over its link: a send waits, settled by the
 * `telegram.sent` or the refusal naming its command, or by nothing in time; a
 * connect carries the token and listens for a refusal, which settles null
 * when none came; a disconnect is a frame the host answers with its state. A
 * runner whose hello did not name `telegram` is never sent one, so a token
 * never goes to a runner that would not keep it.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const CHAT = '-1001234567890';
const TOKEN = '7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['telegram']) {
  const link = {
    hostId: HOST,
    capabilities,
    send: vi.fn().mockReturnValue(true),
  } as unknown as RunnerLink;
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn().mockReturnValue(withLink ? link : undefined),
  };
  const replies = new InProcessLinkReplies();
  return { link, replies, adapter: new RelayTelegramDeviceAdapter(links, replies) };
}

function sentCommand(link: RunnerLink): string {
  return telegramSendSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]).commandId;
}

describe('RelayTelegramDeviceAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a send with the id and time of the telegram.sent that names its command', async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'Green since 10:12.', '42');
    const commandId = sentCommand(link);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).toMatchObject({
      chatId: CHAT,
      text: 'Green since 10:12.',
      replyToId: '42',
    });

    replies.settle(HOST, {
      type: 'telegram.sent',
      commandId,
      id: '43',
      sentAt: '2026-11-08T10:00:00Z',
    });

    await expect(pending).resolves.toEqual({
      kind: 'sent',
      id: '43',
      sentAt: new Date('2026-11-08T10:00:00Z'),
    });
  });

  it('passes the runner’s refusal of a send on with its code', async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'hi');
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: sentCommand(link),
      code: 'TG_004',
      detail: 'Forbidden: bot was blocked by the user',
    });
    await expect(pending).resolves.toEqual({
      kind: 'failed',
      code: 'TG_004',
      detail: 'Forbidden: bot was blocked by the user',
    });
  });

  it('gives up on a send when the host does not answer in time', async () => {
    vi.useFakeTimers();
    const { adapter } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'hi');
    await vi.advanceTimersByTimeAsync(TELEGRAM_SEND_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('hands the token over in telegram.link and reports the host’s refusal of it', async () => {
    const { adapter, link, replies } = harness(true);
    const attempt = adapter.link(HOST, TOKEN);
    expect(attempt.sent).toBe(true);
    const frame = telegramLinkSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(frame.token).toBe(TOKEN);

    replies.settle(HOST, {
      type: 'command.failed',
      commandId: frame.commandId,
      code: 'TG_001',
      detail: 'Unauthorized',
    });
    await expect(attempt.refused).resolves.toEqual({ code: 'TG_001', detail: 'Unauthorized' });
  });

  it('settles a connect with no refusal once the window passes', async () => {
    vi.useFakeTimers();
    const { adapter } = harness(true);
    const attempt = adapter.link(HOST, TOKEN);
    await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_REFUSAL_WINDOW_MS + 1);
    await expect(attempt.refused).resolves.toBeNull();
  });

  it('sends nothing, the token least of all, to a host offline or whose runner holds no Telegram', async () => {
    const offline = harness(false);
    await expect(offline.adapter.send(HOST, CHAT, 'hi')).resolves.toEqual({ kind: 'host_offline' });
    expect(offline.adapter.reach(HOST)).toBe('offline');
    expect(offline.adapter.link(HOST, TOKEN).sent).toBe(false);

    const older = harness(true, ['fs.list']);
    await expect(older.adapter.send(HOST, CHAT, 'hi')).resolves.toEqual({ kind: 'not_supported' });
    expect(older.adapter.link(HOST, TOKEN).sent).toBe(false);
    expect(older.adapter.unlink(HOST)).toBe(false);
    expect(older.adapter.reach(HOST)).toBe('unsupported');
    expect(older.link.send).not.toHaveBeenCalled();
  });
});

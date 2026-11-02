import 'reflect-metadata';
import { type RunnerCapability, whatsappSendSchema } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelayWhatsappDeviceAdapter,
  WHATSAPP_SEND_TIMEOUT_MS,
} from '../infrastructure/relay-whatsapp-device.adapter';

/**
 * A host's WhatsApp device over its link: a send is the one request that
 * waits, settled by the `whatsapp.sent` or the refusal naming its command, or
 * by nothing in time; pairing and unpairing are frames the host answers with
 * its state. A runner whose hello did not name `whatsapp` is never sent one.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const CHAT = '34600333444@s.whatsapp.net';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['whatsapp']) {
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
  return { link, replies, adapter: new RelayWhatsappDeviceAdapter(links, replies) };
}

function sentCommand(link: RunnerLink): string {
  return whatsappSendSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]).commandId;
}

describe('RelayWhatsappDeviceAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a send with the id and time of the whatsapp.sent that names its command', async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'Tuesday works.');
    const commandId = sentCommand(link);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).toMatchObject({
      chatId: CHAT,
      text: 'Tuesday works.',
    });

    replies.settle(HOST, {
      type: 'whatsapp.sent',
      commandId,
      id: '3EB0',
      sentAt: '2026-10-30T10:00:00Z',
    });

    await expect(pending).resolves.toEqual({
      kind: 'sent',
      id: '3EB0',
      sentAt: new Date('2026-10-30T10:00:00Z'),
    });
  });

  it('passes the runner’s refusal on with its code', async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'hi');
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: sentCommand(link),
      code: 'WA_004',
      detail: 'budget',
    });
    await expect(pending).resolves.toEqual({ kind: 'failed', code: 'WA_004', detail: 'budget' });
  });

  it('gives up when the host does not answer in time', async () => {
    vi.useFakeTimers();
    const { adapter } = harness(true);
    const pending = adapter.send(HOST, CHAT, 'hi');
    await vi.advanceTimersByTimeAsync(WHATSAPP_SEND_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('sends nothing to a host that is offline or whose runner holds no WhatsApp', async () => {
    const offline = harness(false);
    await expect(offline.adapter.send(HOST, CHAT, 'hi')).resolves.toEqual({ kind: 'host_offline' });
    expect(offline.adapter.reach(HOST)).toBe('offline');

    const older = harness(true, ['fs.list']);
    await expect(older.adapter.send(HOST, CHAT, 'hi')).resolves.toEqual({ kind: 'not_supported' });
    expect(older.adapter.link(HOST)).toBe(false);
    expect(older.adapter.reach(HOST)).toBe('unsupported');
    expect(older.link.send).not.toHaveBeenCalled();
  });

  it('pairs and unpairs with fire-and-forget frames', () => {
    const { adapter, link } = harness(true);
    expect(adapter.link(HOST)).toBe(true);
    expect(adapter.unlink(HOST)).toBe(true);
    expect(
      vi.mocked(link.send).mock.calls.map(([message]) => (message as { type: string }).type),
    ).toEqual(['whatsapp.link', 'whatsapp.unlink']);
  });
});

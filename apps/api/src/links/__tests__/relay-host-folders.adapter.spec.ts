import 'reflect-metadata';
import { fsListSchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  FS_LIST_TIMEOUT_MS,
  RelayHostFoldersAdapter,
} from '../infrastructure/relay-host-folders.adapter';

/**
 * The folder picker's one request and response over a link that is otherwise
 * fire and forget: an `fs.list` the protocol accepts, settled by the reply
 * that names its command — from that host only — or by its refusal, or by
 * nothing in time. The gateway's half (handing replies here before any other
 * routing) is `relay.gateways.spec.ts`.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const OTHER_HOST = 'e1d7f503-4152-4d6e-9f70-8192a3b4c5d6';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['fs.list']) {
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
  return { link, replies, adapter: new RelayHostFoldersAdapter(links, replies) };
}

/** The command the adapter sent: synchronously, before it starts waiting. */
function sentCommand(link: RunnerLink): string {
  return fsListSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]).commandId;
}

describe('RelayHostFoldersAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends an fs.list and answers with the listing that names its command', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.list(HOST, '/home/jordi/code');
    const commandId = sentCommand(link);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).toMatchObject({ path: '/home/jordi/code' });
    const taken = replies.settle(HOST, {
      type: 'fs.listing',
      commandId,
      path: '/home/jordi/code',
      parent: '/home/jordi',
      home: '/home/jordi',
      entries: [{ name: 'xrp-mobile', branch: 'main' }],
    });

    expect(taken).toBe(true);
    await expect(pending).resolves.toEqual({
      kind: 'listed',
      listing: {
        path: '/home/jordi/code',
        parent: '/home/jordi',
        home: '/home/jordi',
        entries: [{ name: 'xrp-mobile', branch: 'main' }],
      },
    });
  });

  it('asks for the home directory when no path is given', async () => {
    const { adapter, link } = harness(true);
    void adapter.list(HOST);
    sentCommand(link);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).not.toHaveProperty('path');
  });

  it('answers with the runner’s refusal and its code', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.list(HOST, '/nope');
    const commandId = sentCommand(link);
    replies.settle(HOST, { type: 'command.failed', commandId, code: 'FS_001', detail: 'gone' });

    await expect(pending).resolves.toEqual({ kind: 'failed', code: 'FS_001', detail: 'gone' });
  });

  it('takes no reply from another host’s link for this command', async () => {
    const { adapter, link, replies } = harness(true);
    vi.useFakeTimers();

    const pending = adapter.list(HOST, '/home/jordi');
    const commandId = sentCommand(link);
    const taken = replies.settle(OTHER_HOST, {
      type: 'fs.listing',
      commandId,
      path: '/etc',
      parent: '/',
      home: '/root',
      entries: [],
    });
    vi.advanceTimersByTime(FS_LIST_TIMEOUT_MS);

    expect(taken).toBe(false);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('gives up after the timeout, and a late reply is nobody’s', async () => {
    const { adapter, link, replies } = harness(true);
    vi.useFakeTimers();

    const pending = adapter.list(HOST);
    const commandId = sentCommand(link);
    vi.advanceTimersByTime(FS_LIST_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
    expect(
      replies.settle(HOST, {
        type: 'fs.listing',
        commandId,
        path: '/',
        parent: null,
        home: '/',
        entries: [],
      }),
    ).toBe(false);
  });

  it('sends nothing to a host with no link, or to a runner that does not list', async () => {
    const offline = harness(false);
    await expect(offline.adapter.list(HOST)).resolves.toEqual({ kind: 'host_offline' });

    const older = harness(true, ['session.image']);
    await expect(older.adapter.list(HOST)).resolves.toEqual({ kind: 'not_supported' });
    expect(older.link.send).not.toHaveBeenCalled();
  });

  it('answers offline, and waits for nothing, when the frame could not be queued', async () => {
    const { adapter, link } = harness(true);
    vi.mocked(link.send).mockReturnValue(false);

    await expect(adapter.list(HOST)).resolves.toEqual({ kind: 'host_offline' });
  });
});

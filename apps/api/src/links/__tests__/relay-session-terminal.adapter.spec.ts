import 'reflect-metadata';
import { type RunnerCapability, terminalDriveSchema } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelaySessionTerminalAdapter,
  TERMINAL_REPLY_GRACE_MS,
} from '../infrastructure/relay-session-terminal.adapter';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

function harness(capabilities: RunnerCapability[] = ['terminal.drive']) {
  const link = {
    hostId: HOST,
    capabilities,
    send: vi.fn().mockReturnValue(true),
  } as unknown as RunnerLink;
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn().mockReturnValue(link),
  };
  const replies = new InProcessLinkReplies();
  return { link, replies, adapter: new RelaySessionTerminalAdapter(links, replies) };
}

describe('RelaySessionTerminalAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a terminal.drive and answers with the screen that names it', async () => {
    const { adapter, link, replies } = harness();
    const pending = adapter.drive(HOST, SESSION, { text: 'ls', keys: ['Enter'], waitSeconds: 2 });
    const sent = terminalDriveSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ sessionId: SESSION, text: 'ls', keys: ['Enter'] });
    replies.settle(HOST, {
      type: 'terminal.screen',
      commandId: sent.commandId,
      screen: '$ ls\nREADME.md\n$ ',
      matched: false,
      waitedMs: 2000,
    });
    await expect(pending).resolves.toEqual({
      kind: 'screen',
      screen: { screen: '$ ls\nREADME.md\n$ ', matched: false, waitedMs: 2000 },
    });
  });

  // The runner waits up to the drive's own wait before it answers; giving up
  // sooner would call every long wait lost.
  it('waits as long as the drive does, and the grace after', async () => {
    vi.useFakeTimers();
    const { adapter } = harness();
    let settled = false;
    const pending = adapter.drive(HOST, SESSION, { waitSeconds: 30 });
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(TERMINAL_REPLY_GRACE_MS);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('sends nothing to a runner that drives no terminals', async () => {
    const old = harness(['host.exec']);
    await expect(old.adapter.drive(HOST, SESSION, { waitSeconds: 0 })).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(old.link.send).not.toHaveBeenCalled();
  });
});

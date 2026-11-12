import 'reflect-metadata';
import { computerActSchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  HOST_COMPUTER_REPLY_GRACE_MS,
  RelayHostComputerAdapter,
} from '../infrastructure/relay-host-computer.adapter';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const COMMAND = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

function harness(capabilities: RunnerCapability[] = ['computer.use']) {
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
  return { link, replies, adapter: new RelayHostComputerAdapter(links, replies) };
}

describe('RelayHostComputerAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a computer.act and answers with the screen that names it', async () => {
    const { adapter, link, replies } = harness();
    const pending = adapter.act(HOST, { action: 'click', x: 640, y: 412 });
    const sent = computerActSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ action: 'click', x: 640, y: 412 });
    replies.settle(HOST, {
      type: 'computer.screen',
      commandId: sent.commandId,
      image: 'aGk=',
      width: 1280,
      height: 800,
    });
    await expect(pending).resolves.toEqual({
      kind: 'screen',
      screen: { image: 'aGk=', width: 1280, height: 800 },
    });
  });

  // A retried approved call must reach the runner under the id of the first
  // try: that is what lets the runner answer without clicking again.
  it('keeps the command id it is given', async () => {
    const { adapter, link } = harness();
    void adapter.act(HOST, { action: 'click', x: 1, y: 1 }, COMMAND);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).toMatchObject({ commandId: COMMAND });
  });

  // The runner waits the action's own seconds before it captures; giving up
  // sooner would call every long wait lost.
  it('waits as long as the action does, and the grace after', async () => {
    vi.useFakeTimers();
    const { adapter } = harness();
    let settled = false;
    const pending = adapter.act(HOST, { action: 'wait', seconds: 30 });
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(30_000 + HOST_COMPUTER_REPLY_GRACE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('sends nothing to a runner that drives no screen', async () => {
    const old = harness(['terminal.drive']);
    await expect(old.adapter.act(HOST, { action: 'screenshot' })).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(old.link.send).not.toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { browserActSchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  HOST_BROWSER_REPLY_GRACE_MS,
  RelayHostBrowserAdapter,
} from '../infrastructure/relay-host-browser.adapter';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const COMMAND = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

function harness(capabilities: RunnerCapability[] = ['browser.use']) {
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
  return { link, replies, adapter: new RelayHostBrowserAdapter(links, replies) };
}

describe('RelayHostBrowserAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a browser.act and answers with the page that names it', async () => {
    const { adapter, link, replies } = harness();
    const pending = adapter.act(HOST, { browser: 'juno', action: 'click', ref: 'e3' });
    const sent = browserActSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ browser: 'juno', action: 'click', ref: 'e3' });
    replies.settle(HOST, {
      type: 'browser.page',
      commandId: sent.commandId,
      url: 'https://example.com/',
      title: 'Example',
      elements: [{ ref: 'e1', role: 'link', name: 'More' }],
    });
    await expect(pending).resolves.toEqual({
      kind: 'page',
      page: {
        url: 'https://example.com/',
        title: 'Example',
        elements: [{ ref: 'e1', role: 'link', name: 'More' }],
      },
    });
  });

  // A retried approved call must reach the runner under the id of the first
  // try: that is what lets the runner answer without clicking again.
  it('keeps the command id it is given', async () => {
    const { adapter, link } = harness();
    void adapter.act(HOST, { browser: 'juno', action: 'read' }, COMMAND);
    expect(vi.mocked(link.send).mock.calls[0]?.[0]).toMatchObject({ commandId: COMMAND });
  });

  // A first open starts the browser and loads the page; giving up sooner
  // would call a slow site lost while the host is still working on it.
  it('waits as long as the action does, and the grace after', async () => {
    vi.useFakeTimers();
    const { adapter } = harness();
    let settled = false;
    const pending = adapter.act(HOST, { browser: 'juno', action: 'wait', seconds: 10 });
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(10_000 + HOST_BROWSER_REPLY_GRACE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('sends nothing to a runner that drives no browser', async () => {
    const old = harness(['computer.use']);
    await expect(old.adapter.act(HOST, { browser: 'juno', action: 'read' })).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(old.link.send).not.toHaveBeenCalled();
  });
});

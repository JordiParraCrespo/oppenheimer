import 'reflect-metadata';
import {
  type RunnerCapability,
  sessionWindowCloseSchema,
  sessionWindowOpenSchema,
  sessionWindowsListSchema,
} from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelaySessionWindowsAdapter,
  SESSION_WINDOWS_TIMEOUT_MS,
} from '../infrastructure/relay-session-windows.adapter';

/**
 * The Terminal tab's window commands over the link: each is a message the
 * protocol accepts, settled by the `session.windows` that names its command
 * (with the window an open made), by the runner's refusal, or by nothing in
 * time; and never sent to a runner too old to answer, which would open a
 * window without saying which. The runner's half is
 * `apps/runner/internal/cli/link_windows_test.go`.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['session.windows.list']) {
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
  return { link, replies, adapter: new RelaySessionWindowsAdapter(links, replies) };
}

const sentMessage = (link: RunnerLink) => vi.mocked(link.send).mock.calls[0]?.[0];

const WINDOWS = [
  { index: 0, name: 'agent' },
  { index: 2, name: 'zsh' },
];

describe('RelaySessionWindowsAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a window and answers with the windows and the one it made', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.open(HOST, SESSION);
    const message = sessionWindowOpenSchema.strict().parse(sentMessage(link));
    expect(message.sessionId).toBe(SESSION);
    replies.settle(HOST, {
      type: 'session.windows',
      commandId: message.commandId,
      sessionId: SESSION,
      windows: WINDOWS,
      opened: 2,
    });

    await expect(pending).resolves.toEqual({ kind: 'listed', windows: WINDOWS, opened: 2 });
  });

  it('lists and closes with the protocol’s own messages', async () => {
    const { adapter, link, replies } = harness(true);

    const listing = adapter.list(HOST, SESSION);
    const list = sessionWindowsListSchema.strict().parse(sentMessage(link));
    replies.settle(HOST, {
      type: 'session.windows',
      commandId: list.commandId,
      sessionId: SESSION,
      windows: WINDOWS,
    });
    await expect(listing).resolves.toEqual({ kind: 'listed', windows: WINDOWS });

    vi.mocked(link.send).mockClear();
    const closing = adapter.close(HOST, SESSION, 2);
    const close = sessionWindowCloseSchema.strict().parse(sentMessage(link));
    expect(close.window).toBe(2);
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: close.commandId,
      code: 'SESS_001',
      detail: 'no such window: 2',
    });
    await expect(closing).resolves.toEqual({
      kind: 'failed',
      code: 'SESS_001',
      detail: 'no such window: 2',
    });
  });

  it('sends nothing to a host with no link, or to a runner that would not answer', async () => {
    await expect(harness(false).adapter.open(HOST, SESSION)).resolves.toEqual({
      kind: 'host_offline',
    });
    const old = harness(true, ['port.forward']);
    await expect(old.adapter.open(HOST, SESSION)).resolves.toEqual({ kind: 'not_supported' });
    expect(old.link.send).not.toHaveBeenCalled();
  });

  it('times out when the runner does not answer', async () => {
    vi.useFakeTimers();
    const { adapter } = harness(true);
    const pending = adapter.list(HOST, SESSION);
    await vi.advanceTimersByTimeAsync(SESSION_WINDOWS_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });
});

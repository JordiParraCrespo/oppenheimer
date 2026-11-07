import 'reflect-metadata';
import { hostExecSchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  HOST_EXEC_REPLY_GRACE_MS,
  RelayHostExecAdapter,
} from '../infrastructure/relay-host-exec.adapter';

/**
 * A bot's command over the link: a `host.exec` the protocol accepts, settled
 * by the result that names its command, by the host's refusal, or by nothing
 * once the run's own timeout and the grace after it have passed.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const REQUEST = { argv: ['python3', 'report.py'], home: 'bot-1', timeoutSeconds: 30 };

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['host.exec']) {
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
  return { link, replies, adapter: new RelayHostExecAdapter(links, replies) };
}

function sentCommand(link: RunnerLink): string {
  return hostExecSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]).commandId;
}

describe('RelayHostExecAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a host.exec and answers with the run that names its command', async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.run(HOST, REQUEST);
    const commandId = sentCommand(link);
    replies.settle(HOST, {
      type: 'host.exec.result',
      commandId,
      exitCode: 2,
      timedOut: false,
      stdout: '',
      stderr: 'no such file',
      cwd: '/home/jordi/oppenheimer/bots/bot-1',
      durationMs: 12,
    });
    await expect(pending).resolves.toEqual({
      kind: 'ran',
      run: {
        exitCode: 2,
        timedOut: false,
        stdout: '',
        stderr: 'no such file',
        cwd: '/home/jordi/oppenheimer/bots/bot-1',
        durationMs: 12,
      },
    });
  });

  it("passes the host's refusal on with its code", async () => {
    const { adapter, link, replies } = harness(true);
    const pending = adapter.run(HOST, REQUEST);
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: sentCommand(link),
      code: 'EXEC_002',
      detail: 'python3 is not on this host’s allowlist',
    });
    await expect(pending).resolves.toEqual({
      kind: 'failed',
      code: 'EXEC_002',
      detail: 'python3 is not on this host’s allowlist',
    });
  });

  // The runner kills the run at its own timeout and then answers; a wait cut
  // at the folder picker's few seconds would call every real script lost.
  it('waits as long as the run may take, and the grace after', async () => {
    vi.useFakeTimers();
    const { adapter } = harness(true);
    const pending = adapter.run(HOST, REQUEST);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(REQUEST.timeoutSeconds * 1000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(HOST_EXEC_REPLY_GRACE_MS);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  // A retried approved call must reach the runner under its first id, or
  // the runner cannot tell it already ran the program.
  it('sends the command id it is given, so a retry names the same run', () => {
    const { adapter, link } = harness(true);
    void adapter.run(HOST, REQUEST, '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(sentCommand(link)).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('sends nothing to a host with no link, or to a runner that runs no commands', async () => {
    await expect(harness(false).adapter.run(HOST, REQUEST)).resolves.toEqual({
      kind: 'host_offline',
    });
    const old = harness(true, ['fs.list']);
    await expect(old.adapter.run(HOST, REQUEST)).resolves.toEqual({ kind: 'not_supported' });
    expect(old.link.send).not.toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { codexEnvironmentsListSchema, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  CODEX_ENVIRONMENTS_TIMEOUT_MS,
  RelayHostCodexEnvironmentsAdapter,
} from '../infrastructure/relay-host-codex-environments.adapter';

/**
 * The composer's Codex environment picker over the runner link: a
 * `codex.environments.list` the protocol accepts, settled by the reply that
 * names its command, by its refusal, or by nothing in time.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['codex.environments']) {
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
  return { link, replies, adapter: new RelayHostCodexEnvironmentsAdapter(links, replies) };
}

function sentCommand(link: RunnerLink) {
  return codexEnvironmentsListSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
}

describe('RelayHostCodexEnvironmentsAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the repository’s environments and answers with the list that names its command', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.list(HOST, 'jordi/oppenheimer');
    const sent = sentCommand(link);
    expect(sent.repository).toBe('jordi/oppenheimer');
    replies.settle(HOST, {
      type: 'codex.environments',
      commandId: sent.commandId,
      environments: [{ id: 'e_1', label: 'Web', pinned: false, repository: true }],
      recommended: 'e_1',
      source: 'chatgpt',
    });

    await expect(pending).resolves.toEqual({
      kind: 'listed',
      listing: {
        environments: [{ id: 'e_1', label: 'Web', pinned: false, repository: true }],
        recommended: 'e_1',
        source: 'chatgpt',
      },
    });
  });

  // Before a repository is picked the picker still lists the account's
  // environments: the frame names no repository rather than an empty one.
  it('asks for the account’s environments with no repository when none is picked', async () => {
    const { adapter, link } = harness(true);

    void adapter.list(HOST);

    expect(sentCommand(link)).not.toHaveProperty('repository');
  });

  it('answers with Codex’s refusal, in the runner’s words', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.list(HOST, 'jordi/oppenheimer');
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: sentCommand(link).commandId,
      code: 'SESS_009',
      detail: 'Not signed in',
    });

    await expect(pending).resolves.toEqual({
      kind: 'failed',
      code: 'SESS_009',
      detail: 'Not signed in',
    });
  });

  it('gives up after the timeout', async () => {
    const { adapter, link } = harness(true);
    vi.useFakeTimers();

    const pending = adapter.list(HOST, 'jordi/oppenheimer');
    sentCommand(link);
    vi.advanceTimersByTime(CODEX_ENVIRONMENTS_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  it('sends nothing to a host with no link, or to a runner that cannot list them', async () => {
    const offline = harness(false);
    await expect(offline.adapter.list(HOST, 'jordi/oppenheimer')).resolves.toEqual({
      kind: 'host_offline',
    });

    const older = harness(true, ['session.cloud.codex']);
    await expect(older.adapter.list(HOST, 'jordi/oppenheimer')).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(older.link.send).not.toHaveBeenCalled();
  });
});

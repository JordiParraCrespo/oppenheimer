import 'reflect-metadata';
import { type RunnerCapability, sharedPreviewGetSchema } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelaySessionSharedFilesAdapter,
  SHARED_PREVIEW_TIMEOUT_MS,
} from '../infrastructure/relay-session-shared-files.adapter';

/**
 * A bot's ask for a shared file's preview (`product/next-steps/agent-tools.md`
 * §7): a `shared.preview.get` the protocol accepts, settled by the reply that
 * names its command from that host only, by the runner's refusal, or by
 * nothing in time; and never sent to a runner that cannot answer it. The
 * runner's half is `apps/runner/internal/cli/link_shared_test.go`.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const OTHER_HOST = 'e1d7f503-4152-4d6e-9f70-8192a3b4c5d6';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const FILE = '3f9a7c1e2b4d6a80';
const JPEG = '/9j/4AAQSkZJRgABAQ==';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['shared.preview']) {
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
  return { link, replies, adapter: new RelaySessionSharedFilesAdapter(links, replies) };
}

/** The command the adapter sent, held to the protocol strictly. */
function sentCommand(link: RunnerLink): string {
  const sent = sharedPreviewGetSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
  expect(sent).toMatchObject({ sessionId: SESSION, fileId: FILE });
  return sent.commandId;
}

describe('RelaySessionSharedFilesAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the preview and answers with the JPEG that names its command', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.preview(HOST, SESSION, FILE);
    const commandId = sentCommand(link);
    expect(
      replies.settle(HOST, {
        type: 'shared.preview',
        commandId,
        mediaType: 'image/jpeg',
        data: JPEG,
      }),
    ).toBe(true);

    await expect(pending).resolves.toEqual({
      kind: 'preview',
      mediaType: 'image/jpeg',
      data: JPEG,
    });
  });

  // The regression: a refusal read as a timeout, so the bot is told the host
  // is slow when the file is gone or has no preview.
  it('answers with the runner’s refusal and its code', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.preview(HOST, SESSION, FILE);
    const commandId = sentCommand(link);
    replies.settle(HOST, {
      type: 'command.failed',
      commandId,
      code: 'SESS_017',
      detail: 'notes.md',
    });

    await expect(pending).resolves.toEqual({
      kind: 'failed',
      code: 'SESS_017',
      detail: 'notes.md',
    });
  });

  // The regression: another host's runner answering for a session it does not hold.
  it('takes no reply from another host’s link, and times out', async () => {
    const { adapter, link, replies } = harness(true);
    vi.useFakeTimers();

    const pending = adapter.preview(HOST, SESSION, FILE);
    const commandId = sentCommand(link);
    const taken = replies.settle(OTHER_HOST, {
      type: 'shared.preview',
      commandId,
      mediaType: 'image/jpeg',
      data: JPEG,
    });
    vi.advanceTimersByTime(SHARED_PREVIEW_TIMEOUT_MS);

    expect(taken).toBe(false);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
    expect(
      replies.settle(HOST, {
        type: 'shared.preview',
        commandId,
        mediaType: 'image/jpeg',
        data: JPEG,
      }),
    ).toBe(false);
  });

  // The regression: a runner from before this capability would log the frame
  // as unknown and never answer, holding the bot's turn for the timeout.
  it('sends nothing to a host with no link, or to a runner that cannot answer', async () => {
    const offline = harness(false);
    await expect(offline.adapter.preview(HOST, SESSION, FILE)).resolves.toEqual({
      kind: 'host_offline',
    });

    const older = harness(true, ['fs.list']);
    await expect(older.adapter.preview(HOST, SESSION, FILE)).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(older.link.send).not.toHaveBeenCalled();
  });
});

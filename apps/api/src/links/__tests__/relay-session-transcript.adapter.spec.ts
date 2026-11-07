import 'reflect-metadata';
import { type RunnerCapability, transcriptReadSchema } from '@oppenheimer/shared/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { InProcessLinkReplies } from '../infrastructure/in-process-link-replies.adapter';
import {
  RelaySessionTranscriptAdapter,
  TRANSCRIPT_READ_TIMEOUT_MS,
} from '../infrastructure/relay-session-transcript.adapter';

/**
 * A reader's ask for a page of a session's conversation
 * (`product/next-steps/agent-tools.md` §8): a `transcript.read` the protocol
 * accepts, carrying the cursor's conversation and offset as they were, settled
 * by the reply that names its command from that host only, by the runner's
 * refusal, or by nothing in time; and never sent to a runner that cannot
 * answer it. The runner's half is `apps/runner/internal/cli/link_transcript_test.go`.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const OTHER_HOST = 'e1d7f503-4152-4d6e-9f70-8192a3b4c5d6';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['transcript.read']) {
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
  return { link, replies, adapter: new RelaySessionTranscriptAdapter(links, replies) };
}

/** The command the adapter sent, held to the protocol strictly. */
function sent(link: RunnerLink) {
  return transcriptReadSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
}

const PAGE = {
  conversation: 'c4b1e09a7f2d3e65',
  entries: ['{"type":"assistant","message":{"role":"assistant","content":"hi"}}'],
  from: 100,
  next: 180,
  atEnd: false,
  dropped: 1,
};

describe('RelaySessionTranscriptAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks on from the cursor and answers with the page that names its command', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.read(HOST, SESSION, {
      limit: 30,
      conversation: 'c4b1e09a7f2d3e65',
      after: 100,
    });
    const message = sent(link);
    expect(message).toMatchObject({
      sessionId: SESSION,
      limit: 30,
      conversation: 'c4b1e09a7f2d3e65',
      after: 100,
    });
    expect(
      replies.settle(HOST, { type: 'transcript.page', commandId: message.commandId, ...PAGE }),
    ).toBe(true);

    await expect(pending).resolves.toEqual({ kind: 'page', page: PAGE });
  });

  // Without a conversation the runner reads the tail; an `after` beside none
  // would be a cursor the runner cannot place.
  it('asks for the tail with no conversation or offset', async () => {
    const { adapter, link } = harness(true);
    void adapter.read(HOST, SESSION, { limit: 10 });
    const message = sent(link);
    expect(message.conversation).toBeUndefined();
    expect(message.after).toBeUndefined();
  });

  it('answers with the runner’s refusal and its code', async () => {
    const { adapter, link, replies } = harness(true);

    const pending = adapter.read(HOST, SESSION, { limit: 10 });
    replies.settle(HOST, {
      type: 'command.failed',
      commandId: sent(link).commandId,
      code: 'SESS_018',
      detail: 'opencode',
    });

    await expect(pending).resolves.toEqual({
      kind: 'failed',
      code: 'SESS_018',
      detail: 'opencode',
    });
  });

  // The regression: another host's runner answering for a session it does not hold.
  it('takes no reply from another host’s link, and times out', async () => {
    const { adapter, link, replies } = harness(true);
    vi.useFakeTimers();

    const pending = adapter.read(HOST, SESSION, { limit: 10 });
    const { commandId } = sent(link);
    const taken = replies.settle(OTHER_HOST, { type: 'transcript.page', commandId, ...PAGE });
    vi.advanceTimersByTime(TRANSCRIPT_READ_TIMEOUT_MS);

    expect(taken).toBe(false);
    await expect(pending).resolves.toEqual({ kind: 'timed_out' });
  });

  // The regression: a runner from before this capability would log the frame
  // as unknown and never answer, holding the reader for the timeout.
  it('sends nothing to a host with no link, or to a runner that cannot answer', async () => {
    const offline = harness(false);
    await expect(offline.adapter.read(HOST, SESSION, { limit: 10 })).resolves.toEqual({
      kind: 'host_offline',
    });

    const older = harness(true, ['shared.preview']);
    await expect(older.adapter.read(HOST, SESSION, { limit: 10 })).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(older.link.send).not.toHaveBeenCalled();
  });
});

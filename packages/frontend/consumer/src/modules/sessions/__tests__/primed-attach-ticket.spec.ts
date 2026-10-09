import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSUMER_CONFIG } from '../../../config';
import type { AttachTicket } from '../session.entity';
import type { SessionsRepository } from '../sessions.repository';
import { SessionsService } from '../sessions.service';

/**
 * A pointer resting on a session's row mints its attach ticket, and the dial
 * the click starts presents that ticket instead of minting another: one round
 * trip fewer between the click and the terminal. A ticket is single use, so
 * only the first dial may take it, and a primed ticket that has waited too
 * long is left for a fresh one rather than refused at the gateway.
 */

/** The ticket is the socket's subprotocol; the fake keeps what each dial presented. */
const presented: string[] = [];

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  readyState = FakeSocket.CONNECTING;
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: string, protocols: string[]) {
    presented.push(protocols[0] ?? '');
  }
  send() {}
  close() {}
}

function service() {
  let minted = 0;
  const issueAttachTicket = vi.fn(
    async (_id: string, window: number): Promise<AttachTicket> => ({
      ticket: `t${++minted}`,
      url: '/api/v1/relay/attach',
      expiresAt: new Date(Date.now() + 60_000),
      window,
    }),
  );
  const repository = { issueAttachTicket } as unknown as SessionsRepository;
  return { sessions: new SessionsService(repository, 'http://api.test'), issueAttachTicket };
}

async function dial(sessions: SessionsService) {
  const before = presented.length;
  const stream = sessions.openStream('s-1');
  await vi.waitFor(() => expect(presented.length).toBe(before + 1));
  stream.dispose();
  return presented.at(-1);
}

describe('a primed attach ticket', () => {
  beforeEach(() => {
    presented.length = 0;
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is what the next dial presents, without a second mint', async () => {
    const { sessions, issueAttachTicket } = service();
    sessions.primeAttachTicket('s-1');
    expect(await dial(sessions)).toBe('t1');
    expect(issueAttachTicket).toHaveBeenCalledTimes(1);
  });

  it('is presented once: the dial after it mints its own', async () => {
    const { sessions } = service();
    sessions.primeAttachTicket('s-1');
    await dial(sessions);
    expect(await dial(sessions)).toBe('t2');
  });

  it('is minted once however often the pointer comes back', () => {
    const { sessions, issueAttachTicket } = service();
    sessions.primeAttachTicket('s-1');
    sessions.primeAttachTicket('s-1');
    sessions.primeAttachTicket('s-1');
    expect(issueAttachTicket).toHaveBeenCalledTimes(1);
  });

  it('is passed over once it has waited too long', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { sessions } = service();
    sessions.primeAttachTicket('s-1');
    vi.setSystemTime(Date.now() + CONSUMER_CONFIG.stream.primedTicketMs + 1);
    expect(await dial(sessions)).toBe('t2');
  });

  it('gives way to a fresh mint when it failed', async () => {
    const { sessions, issueAttachTicket } = service();
    issueAttachTicket.mockRejectedValueOnce(new Error('network'));
    sessions.primeAttachTicket('s-1');
    expect(await dial(sessions)).toBe('t1');
  });
});

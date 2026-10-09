import { inject, injectable, optional } from 'inversify';
import { CONSUMER_CONFIG } from '../../config';
import { TOKENS } from '../../di/tokens';
import type {
  AttachTicket,
  CreateSessionInput,
  PrepareSessionInput,
  SessionAttachment,
  SessionEntity,
} from './session.entity';
import { deriveSessionStartProgress, type SessionStartProgress } from './session-steps';
import type { SessionsRepository } from './sessions.repository';
import { AttachSessionStream, type SessionStream } from './stream/session-stream';

@injectable()
export class SessionsService {
  /** Tickets minted ahead of a dial (`primeAttachTicket`), by session and window. */
  private readonly primedTickets = new Map<string, PrimedTicket>();

  constructor(
    @inject(TOKENS.SessionsRepository)
    private readonly repository: SessionsRepository,
    @inject(TOKENS.ApiBaseUrl)
    @optional()
    private readonly apiBaseUrl: string = '',
  ) {}

  findAll(): Promise<SessionEntity[]> {
    return this.repository.findAll();
  }

  findById(id: string): Promise<SessionEntity> {
    return this.repository.findById(id);
  }

  /**
   * How a session's start is going, as the host reported it. `failed` is the
   * row's lifecycle, which can run a read ahead of the log's reason.
   */
  async startProgress(id: string, { failed }: { failed: boolean }): Promise<SessionStartProgress> {
    return deriveSessionStartProgress(await this.repository.findStartLog(id), { failed });
  }

  create(input: CreateSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    return this.repository.create(input, idempotencyKey);
  }

  prepare(input: PrepareSessionInput): Promise<string[]> {
    return this.repository.prepare(input);
  }

  rename(id: string, name: string): Promise<SessionEntity> {
    return this.repository.rename(id, name);
  }

  move(id: string, projectId: string): Promise<SessionEntity> {
    return this.repository.move(id, projectId);
  }

  restart(id: string): Promise<SessionEntity> {
    return this.repository.restart(id);
  }

  close(id: string, acceptUnpushedWork = false): Promise<SessionEntity> {
    return this.repository.close(id, acceptUnpushedWork);
  }

  issueAttachTicket(id: string, window = 0): Promise<AttachTicket> {
    return this.repository.issueAttachTicket(id, window);
  }

  uploadAttachment(file: Blob): Promise<SessionAttachment> {
    return this.repository.uploadAttachment(file);
  }

  pasteFile(id: string, file: Blob, window = 0): Promise<void> {
    return this.repository.pasteFile(id, file, window);
  }

  /**
   * One window's terminal, live: the attach socket, its reconnect ladder, a
   * fresh ticket per dial and the byte credit (`01-protocol.md`). Nothing is
   * opened until this is called, and `dispose()` closes it; the platform only
   * renders what it delivers.
   */
  openStream(id: string, window = 0): SessionStream {
    return new AttachSessionStream({
      apiBaseUrl: this.apiBaseUrl,
      issueTicket: () => this.takeAttachTicket(id, window),
    });
  }

  /**
   * Mint a window's attach ticket before the terminal asks for one, so the
   * dial that follows a click skips a round trip. Nothing waits on it: a mint
   * that fails is forgotten, and the stream's own mint reports the reason. A
   * ticket already waiting and still fresh is kept, so a pointer passing back
   * and forth over a row mints once.
   */
  primeAttachTicket(id: string, window = 0): void {
    const key = ticketKey(id, window);
    const waiting = this.primedTickets.get(key);
    if (waiting && isFresh(waiting)) return;
    const primed: PrimedTicket = {
      ticket: this.repository.issueAttachTicket(id, window),
      mintedAt: Date.now(),
    };
    this.primedTickets.set(key, primed);
    primed.ticket.catch(() => {
      if (this.primedTickets.get(key) === primed) this.primedTickets.delete(key);
    });
  }

  /**
   * The ticket a dial uses: the primed one when it is still fresh, a new one
   * otherwise. Taken, never shared, because the gateway spends a ticket on
   * the socket that presents it.
   */
  private takeAttachTicket(id: string, window: number): Promise<AttachTicket> {
    const key = ticketKey(id, window);
    const primed = this.primedTickets.get(key);
    this.primedTickets.delete(key);
    if (!primed || !isFresh(primed)) return this.issueAttachTicket(id, window);
    return primed.ticket.catch(() => this.issueAttachTicket(id, window));
  }
}

interface PrimedTicket {
  ticket: Promise<AttachTicket>;
  /** The browser's clock, not the API's `expiresAt`: the two need not agree. */
  mintedAt: number;
}

function ticketKey(id: string, window: number): string {
  return `${id}:${window}`;
}

function isFresh(primed: PrimedTicket): boolean {
  return Date.now() - primed.mintedAt < CONSUMER_CONFIG.stream.primedTicketMs;
}

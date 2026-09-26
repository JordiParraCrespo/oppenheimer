import { inject, injectable, optional } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AttachTicket, CreateSessionInput, SessionEntity } from './session.entity';
import { deriveSessionStartProgress, type SessionStartProgress } from './session-steps';
import type { SessionsRepository } from './sessions.repository';
import { AttachSessionStream, type SessionStream } from './stream/session-stream';

@injectable()
export class SessionsService {
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

  /**
   * Start a session.
   *
   * The `idempotencyKey` is the caller's, not this layer's: it has to survive a
   * lost response and a second press of the same button, and only the screen
   * holding that draft knows the two are the same attempt. Minting one here per
   * call would key every retry differently, which is the same as having none.
   */
  create(input: CreateSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    return this.repository.create(input, idempotencyKey);
  }

  stop(id: string): Promise<SessionEntity> {
    return this.repository.stop(id);
  }

  /** A single-use pass to one window's terminal; see the repository. */
  issueAttachTicket(id: string, window = 0): Promise<AttachTicket> {
    return this.repository.issueAttachTicket(id, window);
  }

  /** Give one window's prompt an image; see the repository. */
  pasteImage(id: string, image: Blob, window = 0): Promise<void> {
    return this.repository.pasteImage(id, image, window);
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
      issueTicket: () => this.issueAttachTicket(id, window),
    });
  }
}

import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AttachTicket, CreateSessionInput, SessionEntity } from './session.entity';
import type { SessionsRepository } from './sessions.repository';

@injectable()
export class SessionsService {
  constructor(
    @inject(TOKENS.SessionsRepository)
    private readonly repository: SessionsRepository,
  ) {}

  findAll(): Promise<SessionEntity[]> {
    return this.repository.findAll();
  }

  findById(id: string): Promise<SessionEntity> {
    return this.repository.findById(id);
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
}

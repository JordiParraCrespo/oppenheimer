import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { CreateSessionInput, SessionEntity } from './session.entity';
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

  create(input: CreateSessionInput): Promise<SessionEntity> {
    return this.repository.create(input);
  }

  stop(id: string): Promise<void> {
    return this.repository.stop(id);
  }
}

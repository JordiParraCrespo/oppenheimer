import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { RoutineEntity } from './routine.entity';
import type { RoutinesRepository } from './routines.repository';

@injectable()
export class RoutinesService {
  constructor(
    @inject(TOKENS.RoutinesRepository)
    private readonly repository: RoutinesRepository,
  ) {}

  findAll(): Promise<RoutineEntity[]> {
    return this.repository.findAll();
  }
}

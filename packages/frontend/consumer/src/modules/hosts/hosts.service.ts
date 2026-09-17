import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { HostEntity, HostPairing } from './host.entity';
import type { HostsRepository } from './hosts.repository';

@injectable()
export class HostsService {
  constructor(
    @inject(TOKENS.HostsRepository)
    private readonly repository: HostsRepository,
  ) {}

  findAll(): Promise<HostEntity[]> {
    return this.repository.findAll();
  }

  pair(): Promise<HostPairing> {
    return this.repository.pair();
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }
}

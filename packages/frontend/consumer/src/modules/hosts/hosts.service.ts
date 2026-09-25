import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { HostEntity, HostPairing, HostPairingToken } from './host.entity';
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

  /**
   * Mint a registration token for a machine that will adopt `name`, revoking
   * the caller's token `replaces` in the same write when it is given.
   */
  pair(name: string, replaces?: string): Promise<HostPairing> {
    return this.repository.pair(name, replaces);
  }

  /** The caller's pairing tokens, so Add host can tell which one was spent. */
  pairings(): Promise<HostPairingToken[]> {
    return this.repository.pairings();
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }
}

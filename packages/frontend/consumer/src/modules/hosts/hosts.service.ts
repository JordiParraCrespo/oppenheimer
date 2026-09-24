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

  /** Mint a registration token for a machine that will adopt `name`. */
  pair(name: string): Promise<HostPairing> {
    return this.repository.pair(name);
  }

  /** The caller's pairing tokens, so Add host can tell which one was spent. */
  pairings(): Promise<HostPairingToken[]> {
    return this.repository.pairings();
  }

  /** Revoke a pairing token nobody spent. */
  revokePairing(id: string): Promise<void> {
    return this.repository.revokePairing(id);
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }
}

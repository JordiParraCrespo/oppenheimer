import type { ClientDeployment } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { CapabilitiesRepository } from './capabilities.repository';

@injectable()
export class CapabilitiesService {
  constructor(
    @inject(TOKENS.CapabilitiesRepository)
    private readonly capabilitiesRepository: CapabilitiesRepository,
  ) {}

  async get(): Promise<ClientDeployment> {
    return this.capabilitiesRepository.get();
  }
}

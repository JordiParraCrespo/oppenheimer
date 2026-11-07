import type { ApiVersion } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { ReleaseRepository } from './release.repository';

/**
 * Which release each side runs. The console's own is built in
 * (`__APP_VERSION__` in the app); the API's is read from it.
 */
@injectable()
export class ReleaseService {
  constructor(
    @inject(TOKENS.ReleaseRepository)
    private readonly releaseRepository: ReleaseRepository,
  ) {}

  async getApiVersion(): Promise<ApiVersion> {
    return this.releaseRepository.getApiVersion();
  }
}

import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { InstallationEntity, RepositoryEntity } from './installation.entity';
import type { InstallationsRepository } from './installations.repository';

@injectable()
export class InstallationsService {
  constructor(
    @inject(TOKENS.InstallationsRepository)
    private readonly repository: InstallationsRepository,
  ) {}

  findAll(): Promise<InstallationEntity[]> {
    return this.repository.findAll();
  }

  /** Attach the installation GitHub just created, using the code from its redirect. */
  connect(githubInstallationId: number, code: string): Promise<InstallationEntity> {
    return this.repository.connect(githubInstallationId, code);
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  branches(installationId: string, githubRepoId: number) {
    return this.repository.branches(installationId, githubRepoId);
  }

  repositories(installationId: string): Promise<RepositoryEntity[]> {
    return this.repository.repositories(installationId);
  }
}

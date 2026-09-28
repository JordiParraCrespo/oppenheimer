import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  InstallationCallback,
  InstallationEntity,
  InstallationStart,
  RepositoryEntity,
} from './installation.entity';
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

  /** Mint the install state and the App URL that carries it. On click only. */
  startInstall(): Promise<InstallationStart> {
    return this.repository.startInstall();
  }

  /** Attach the installation GitHub just created, using the values on its redirect. */
  connect(callback: InstallationCallback): Promise<InstallationEntity> {
    return this.repository.connect(callback);
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

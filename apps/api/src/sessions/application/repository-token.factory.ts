import { Inject, Injectable } from '@nestjs/common';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import { HOST_KEY } from '../../hosts/hosts.di-tokens';

/** A repository token sealed to one host: only that host can read it. */
export interface SealedRepositoryToken {
  /** The installation token, sealed to the host's Ed25519 identity. Base64. */
  sealed: string;
  expiresAt: Date;
}

/**
 * Mints an installation token for one repository and seals it to one host's
 * key, for git on a host where no live checkout names it to a credential ask:
 * a repository being prepared before its session exists, or a cloud session's
 * one fetch. The relay carries it and cannot read it.
 */
@Injectable()
export class RepositoryTokenFactory {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(HOST_KEY)
    private readonly keys: HostKeyPort,
  ) {}

  /** Null when the host has no key to seal to (it has never said hello). */
  async sealed(
    hostId: string,
    installationId: string,
    githubRepoId: number,
  ): Promise<SealedRepositoryToken | null> {
    const minted = await this.repositories.mintRepositoryToken(installationId, githubRepoId);
    const sealed = await this.keys.sealFor(hostId, Buffer.from(minted.token, 'utf8'));
    return sealed ? { sealed, expiresAt: minted.expiresAt } : null;
  }
}

import type {
  InstallationAddress,
  RepositoryAddress,
  RepositorySource,
} from './repository-address.types';

/** The installation an address names on the wire: null for one read through tokens. */
export function installationIdOf(address: RepositoryAddress): string | null {
  return address.kind === 'installation' ? address.installationId : null;
}

/** An address from the wire's two fields, the inverse of {@link installationIdOf}. */
export function addressOf(installationId: string | null, githubRepoId: number): RepositoryAddress {
  return installationId === null
    ? { kind: 'tokens', githubRepoId }
    : { kind: 'installation', installationId, githubRepoId };
}

/** An address from a route's source segment and repository id. */
export function addressFrom(source: RepositorySource, githubRepoId: number): RepositoryAddress {
  return source.kind === 'installation'
    ? { kind: 'installation', installationId: source.installationId, githubRepoId }
    : { kind: 'tokens', githubRepoId };
}

/** One key per repository and source, for sets and maps. */
export function addressKeyOf(address: RepositoryAddress): string {
  return `${installationIdOf(address) ?? 'tokens'}:${address.githubRepoId}`;
}

export function isInstallationAddress<T extends RepositoryAddress>(
  address: T,
): address is Extract<T, InstallationAddress> {
  return address.kind === 'installation';
}

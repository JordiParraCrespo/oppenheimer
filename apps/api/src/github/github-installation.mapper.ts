import { Injectable } from '@nestjs/common';
import { ArgumentInvalidException, type Mapper } from '@oppenheimer/backend-ddd';
import { GithubInstallationOrmEntity } from './database/github-installation.orm-entity';
import {
  type AccountType,
  GithubInstallationEntity,
  type RefreshInstallationProps,
  type RepositorySelection,
} from './domain/github-installation.entity';
import { InstallationResponseDto } from './dtos/installation.response.dto';
import { RepositoryBranchResponseDto, RepositoryResponseDto } from './dtos/repository.response.dto';
import type {
  GithubBranch,
  GithubInstallationClaim,
  GithubRepository,
} from './infrastructure/github-app.port';

/** GitHub only ever reports these two; anything else is a selected install. */
function asRepositorySelection(value: string): RepositorySelection {
  return value === 'all' ? 'all' : 'selected';
}

/**
 * The column is a `varchar` with a check constraint, so only these two can be in
 * it. Reading anything else means the constraint was dropped, and refusing here
 * is better than carrying a value the domain says cannot exist.
 */
function asAccountType(value: string): AccountType {
  if (value === 'User' || value === 'Organization') return value;
  throw new ArgumentInvalidException(`Unknown GitHub account type "${value}"`);
}

/**
 * Maps the installation aggregate between its domain, persistence and response
 * shapes — and the adapter's normalized GitHub shapes into the DTOs the routes
 * publish and the props the aggregate takes.
 *
 * Those last two are here rather than in the handlers on purpose: a handler that
 * assembled a DTO field by field would be the second place the wire shape is
 * decided.
 */
@Injectable()
export class GithubInstallationMapper
  implements Mapper<GithubInstallationEntity, GithubInstallationOrmEntity, InstallationResponseDto>
{
  toPersistence(entity: GithubInstallationEntity): GithubInstallationOrmEntity {
    const record = new GithubInstallationOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    // A bigint column, which the driver exchanges as a string.
    record.githubInstallationId = String(entity.githubInstallationId);
    record.accountLogin = entity.accountLogin;
    record.accountType = entity.accountType;
    record.repositorySelection = entity.repositorySelection;
    record.installedByUserId = entity.installedByUserId;
    record.suspendedAt = entity.suspendedAt;
    record.deletedAt = entity.deletedAt;
    return record;
  }

  toDomain(record: GithubInstallationOrmEntity): GithubInstallationEntity {
    return GithubInstallationEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        githubInstallationId: Number(record.githubInstallationId),
        accountLogin: record.accountLogin,
        accountType: asAccountType(record.accountType),
        repositorySelection: asRepositorySelection(record.repositorySelection),
        installedByUserId: record.installedByUserId,
        suspendedAt: record.suspendedAt,
        deletedAt: record.deletedAt,
      },
    });
  }

  toResponse(entity: GithubInstallationEntity): InstallationResponseDto {
    const dto = new InstallationResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.githubInstallationId = entity.githubInstallationId;
    dto.accountLogin = entity.accountLogin;
    dto.accountType = entity.accountType;
    dto.repositorySelection = entity.repositorySelection;
    dto.installedByUserId = entity.installedByUserId;
    dto.suspendedAt = entity.suspendedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  /** What GitHub reported about a claim → what the aggregate takes to refresh. */
  toRefreshProps(
    claim: GithubInstallationClaim,
    installedByUserId: string,
  ): RefreshInstallationProps {
    return {
      accountLogin: claim.accountLogin,
      accountType: claim.accountType,
      repositorySelection: claim.repositorySelection,
      installedByUserId,
      // GitHub's own answer, carried through rather than cleared: a reconnect
      // must not be a way to unsuspend an installation GitHub still holds.
      suspendedAt: claim.suspendedAt,
    };
  }

  toRepositoryResponse(repository: GithubRepository): RepositoryResponseDto {
    const dto = new RepositoryResponseDto();
    dto.githubRepoId = repository.githubRepoId;
    dto.name = repository.name;
    dto.fullName = repository.fullName;
    dto.defaultBranch = repository.defaultBranch;
    dto.private = repository.private;
    dto.archived = repository.archived;
    dto.pushedAt = repository.pushedAt;
    return dto;
  }

  toBranchResponse(branch: GithubBranch, defaultBranch: string): RepositoryBranchResponseDto {
    const dto = new RepositoryBranchResponseDto();
    dto.name = branch.name;
    dto.commitSha = branch.commitSha;
    dto.protected = branch.protected;
    dto.isDefault = branch.name === defaultBranch;
    return dto;
  }
}

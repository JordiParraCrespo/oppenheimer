import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { SessionCheckoutEntity } from './domain/session-checkout.entity';
import { SessionCheckoutResponseDto } from './dtos/session.response.dto';

/**
 * A session's checkout across the boundary: its `session_checkout` row and its
 * place in the session's response. A member of the session aggregate, so
 * `WorkSessionMapper` assembles it into the session and
 * `SessionCheckoutRepository` writes it.
 *
 * `githubRepoId` travels everywhere as the string the driver exchanges a bigint as,
 * never coerced: GitHub's ids fit in a number today and the column says they are not
 * promised to.
 */
export class SessionCheckoutMapper {
  static toPersistence(entity: SessionCheckoutEntity): SessionCheckoutOrmEntity {
    const record = new SessionCheckoutOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.sessionId = entity.sessionId;
    record.installationId = entity.installationId;
    record.githubRepoId = entity.githubRepoId;
    record.repositoryFullName = entity.repositoryFullName;
    record.storeDirectoryName = entity.storeDirectoryName;
    record.directoryName = entity.directoryName;
    record.mode = entity.mode;
    record.baseBranch = entity.baseBranch;
    record.branch = entity.branch;
    record.worktreeCreatedAt = entity.worktreeCreatedAt;
    record.pushedAt = entity.pushedAt;
    record.removedAt = entity.removedAt;
    return record;
  }

  static toDomain(record: SessionCheckoutOrmEntity): SessionCheckoutEntity {
    return SessionCheckoutEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      props: {
        organizationId: record.organizationId,
        sessionId: record.sessionId,
        installationId: record.installationId,
        githubRepoId: record.githubRepoId,
        repositoryFullName: record.repositoryFullName,
        storeDirectoryName: record.storeDirectoryName,
        directoryName: record.directoryName,
        mode: record.mode,
        baseBranch: record.baseBranch,
        branch: record.branch,
        worktreeCreatedAt: record.worktreeCreatedAt,
        pushedAt: record.pushedAt,
        removedAt: record.removedAt,
      },
    });
  }

  static toResponse(entity: SessionCheckoutEntity): SessionCheckoutResponseDto {
    const dto = new SessionCheckoutResponseDto();
    dto.id = entity.id;
    dto.installationId = entity.installationId;
    dto.githubRepoId = entity.githubRepoId;
    dto.repositoryFullName = entity.repositoryFullName;
    dto.directoryName = entity.directoryName;
    dto.storeDirectoryName = entity.storeDirectoryName;
    dto.mode = entity.mode;
    dto.baseBranch = entity.baseBranch;
    dto.branch = entity.branch;
    return dto;
  }
}

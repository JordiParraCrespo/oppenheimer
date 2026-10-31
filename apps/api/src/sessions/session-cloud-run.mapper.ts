import type { StartCloudSessionDto } from '@oppenheimer/shared';
import type { CloudAgentLaunch } from '../cloud-agents/application/cloud-runs.port';
import { SessionCloudRunOrmEntity } from './database/session-cloud-run.orm-entity';
import { type CloudRunReport, SessionCloudRunEntity } from './domain/session-cloud-run.entity';
import { SessionCloudRunResponseDto } from './dtos/session.response.dto';

/**
 * A cloud session's vendor half across the boundary: its `session_cloud_run`
 * row, its place in the session's response, and the launch a vendor is asked
 * for and answers. A member of the session aggregate, so `WorkSessionMapper`
 * assembles it into the session and `SessionCloudRunRepository` writes it.
 */
export class SessionCloudRunMapper {
  static toPersistence(entity: SessionCloudRunEntity): SessionCloudRunOrmEntity {
    const record = new SessionCloudRunOrmEntity();
    record.sessionId = entity.sessionId;
    record.organizationId = entity.organizationId;
    record.provider = entity.provider;
    record.externalId = entity.externalId;
    record.url = entity.url;
    record.repositoryUrl = entity.repositoryUrl;
    record.latestRunId = entity.latestRunId;
    record.status = entity.status;
    record.branch = entity.branch;
    record.pullRequestUrl = entity.pullRequestUrl;
    record.summary = entity.summary;
    record.syncedAt = entity.syncedAt;
    return record;
  }

  static toDomain(record: SessionCloudRunOrmEntity): SessionCloudRunEntity {
    return SessionCloudRunEntity.create({
      id: record.sessionId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        provider: record.provider,
        externalId: record.externalId,
        url: record.url,
        repositoryUrl: record.repositoryUrl,
        latestRunId: record.latestRunId,
        status: record.status,
        branch: record.branch,
        pullRequestUrl: record.pullRequestUrl,
        summary: record.summary,
        syncedAt: record.syncedAt,
      },
    });
  }

  static toResponse(entity: SessionCloudRunEntity): SessionCloudRunResponseDto {
    const dto = new SessionCloudRunResponseDto();
    dto.provider = entity.provider;
    dto.url = entity.url;
    dto.repositoryUrl = entity.repositoryUrl;
    dto.status = entity.status;
    dto.branch = entity.branch;
    dto.pullRequestUrl = entity.pullRequestUrl;
    dto.syncedAt = entity.syncedAt;
    return dto;
  }

  /** What a cloud session asks its vendor to start, under the session's own id. */
  static toLaunch(
    sessionId: string,
    input: StartCloudSessionDto,
    source: { repositoryUrl: string; startingRef: string },
  ): CloudAgentLaunch {
    return {
      id: sessionId,
      prompt: input.prompt,
      repositoryUrl: source.repositoryUrl,
      startingRef: source.startingRef,
      model: input.model ?? null,
    };
  }

  /** The run the vendor started, as the session's vendor half keeps it. */
  static toLaunched(
    session: { id: string; organizationId: string },
    input: StartCloudSessionDto,
    launched: { externalId: string; url: string | null; run: CloudRunReport },
    repositoryUrl: string,
    now: Date,
  ): SessionCloudRunEntity {
    return SessionCloudRunEntity.launched(
      {
        organizationId: session.organizationId,
        sessionId: session.id,
        provider: input.provider,
        externalId: launched.externalId,
        url: launched.url,
        repositoryUrl,
        run: launched.run,
      },
      now,
    );
  }
}

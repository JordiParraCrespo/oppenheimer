import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { LaunchCloudAgentDto } from '@oppenheimer/shared';
import type { CloudAgentLaunch, LaunchedCloudAgent } from './application/cloud-agent-provider.port';
import { CloudAgentOrmEntity } from './database/cloud-agent.orm-entity';
import { CloudAgentEntity, type LaunchedCloudAgentProps } from './domain/cloud-agent.entity';
import { CloudAgentResponseDto } from './dtos/cloud-agent.response.dto';

/** The longest name a row keeps (`cloud_agent.name`); a vendor's may run longer. */
const NAME_MAX = 200;

/** Who launches, in which workspace, under which id. */
export interface CloudAgentLauncher {
  id: string;
  organizationId: string;
  createdByUserId: string;
}

@Injectable()
export class CloudAgentMapper
  implements Mapper<CloudAgentEntity, CloudAgentOrmEntity, CloudAgentResponseDto>
{
  /** What the vendor is asked for: an option left out is null, the vendor's default. */
  toLaunch(id: string, input: LaunchCloudAgentDto): CloudAgentLaunch {
    return {
      id,
      prompt: input.prompt,
      repositoryUrl: input.repositoryUrl,
      startingRef: input.startingRef ?? null,
      model: input.model ?? null,
      autoCreatePr: input.autoCreatePr,
    };
  }

  /** The launch as asked and the vendor's answer, as `CloudAgentEntity.launched` takes them. */
  toLaunchedProps(
    launcher: CloudAgentLauncher,
    launch: CloudAgentLaunch,
    provider: CloudAgentEntity['provider'],
    launched: LaunchedCloudAgent,
  ): LaunchedCloudAgentProps {
    return {
      ...launcher,
      provider,
      prompt: launch.prompt,
      repositoryUrl: launch.repositoryUrl,
      startingRef: launch.startingRef,
      model: launch.model,
      autoCreatePr: launch.autoCreatePr,
      externalId: launched.externalId,
      url: launched.url,
      name: launched.name.slice(0, NAME_MAX),
      run: launched.run,
    };
  }

  toPersistence(entity: CloudAgentEntity): CloudAgentOrmEntity {
    const record = new CloudAgentOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.createdByUserId = entity.createdByUserId;
    record.provider = entity.provider;
    record.externalId = entity.externalId;
    record.url = entity.url;
    record.name = entity.name;
    record.prompt = entity.prompt;
    record.repositoryUrl = entity.repositoryUrl;
    record.startingRef = entity.startingRef;
    record.model = entity.model;
    record.autoCreatePr = entity.autoCreatePr;
    record.status = entity.status;
    record.latestRunId = entity.latestRunId;
    record.branch = entity.branch;
    record.pullRequestUrl = entity.pullRequestUrl;
    record.summary = entity.summary;
    record.syncedAt = entity.syncedAt;
    return record;
  }

  toDomain(record: CloudAgentOrmEntity): CloudAgentEntity {
    return CloudAgentEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        createdByUserId: record.createdByUserId,
        provider: record.provider,
        externalId: record.externalId,
        url: record.url,
        name: record.name,
        prompt: record.prompt,
        repositoryUrl: record.repositoryUrl,
        startingRef: record.startingRef,
        model: record.model,
        autoCreatePr: record.autoCreatePr,
        status: record.status,
        latestRunId: record.latestRunId,
        branch: record.branch,
        pullRequestUrl: record.pullRequestUrl,
        summary: record.summary,
        syncedAt: record.syncedAt,
      },
    });
  }

  toResponse(entity: CloudAgentEntity): CloudAgentResponseDto {
    const dto = new CloudAgentResponseDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.externalId = entity.externalId;
    dto.url = entity.url;
    dto.name = entity.name;
    dto.prompt = entity.prompt;
    dto.repositoryUrl = entity.repositoryUrl;
    dto.startingRef = entity.startingRef;
    dto.model = entity.model;
    dto.autoCreatePr = entity.autoCreatePr;
    dto.status = entity.status;
    dto.branch = entity.branch;
    dto.pullRequestUrl = entity.pullRequestUrl;
    dto.summary = entity.summary;
    dto.syncedAt = entity.syncedAt.toISOString();
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

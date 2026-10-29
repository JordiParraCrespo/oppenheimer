import { Injectable } from '@nestjs/common';
import { SCOPES, type Scope } from '@oppenheimer/shared';
import {
  AUTOMATION_OVERLAP_POLICIES,
  AUTOMATION_PAUSED_REASONS,
  AUTOMATION_PLACES,
  type AutomationOverlapPolicy,
  type AutomationPausedReason,
  type AutomationPermission,
  type AutomationPlace,
  SCHEDULE_FREQUENCIES,
  type ScheduleFrequency,
  type TriggerFilter,
} from '@oppenheimer/shared/automations';
import { botTargetOf } from './application/bot-target.policy';
import { sessionTargetOf } from './application/session-target.policy';
import { AutomationRunMapper } from './automation-run.mapper';
import type { AutomationOrmEntity } from './database/automation.orm-entity';
import type { AutomationRevisionOrmEntity } from './database/automation-revision.orm-entity';
import type { AutomationSettingsOrmEntity } from './database/automation-settings.orm-entity';
import type { AutomationTriggerOrmEntity } from './database/automation-trigger.orm-entity';
import { AutomationEntity } from './domain/automation.entity';
import type {
  AutomationRepository,
  AutomationTarget,
  AutomationTriggerProps,
  ScheduleTriggerConfig,
  SessionRevisionProps,
} from './domain/automation.types';
import type { WorkspaceLimits } from './domain/automation-limits.policy';
import type { AutomationRunDigest } from './domain/automation-read.types';
import {
  AutomationRepositoryResponseDto,
  AutomationResponseDto,
  AutomationRevisionResponseDto,
  AutomationTriggerResponseDto,
} from './dtos/automation.response.dto';
import { BotRoutineResponseDto } from './dtos/bot-routine.response.dto';

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return (values as readonly unknown[]).includes(value) ? (value as T) : null;
}

/**
 * A workspace's `automation_settings` row as the limits it sets; no row is no
 * override. Pure, so the settings store and the scheduler's claim — which
 * reads the rows inside its own transaction — shape them the same way.
 */
export function workspaceLimitsOf(record: AutomationSettingsOrmEntity | null): WorkspaceLimits {
  if (!record) return {};
  return {
    maxRunsPerAutomationHour: record.maxRunsPerAutomationHour,
    maxRunsPerWorkspaceHour: record.maxRunsPerWorkspaceHour,
    liveRunsPerHost: record.liveRunsPerHost,
    overlap: oneOf(AUTOMATION_OVERLAP_POLICIES, record.overlap),
    staleTtlSeconds: record.staleTtlSeconds,
    missedGraceSeconds: record.missedGraceSeconds,
    maxRunSeconds: record.maxRunSeconds,
  };
}

/**
 * The automation aggregate between its rows — the automation, its current
 * revision, its triggers — and the response the console reads. Stored json is
 * narrowed once, here: a value this build does not know reads as the safest
 * one rather than throwing on somebody's list.
 */
@Injectable()
export class AutomationMapper {
  constructor(private readonly runs: AutomationRunMapper) {}

  toDomain(
    record: AutomationOrmEntity,
    revision: AutomationRevisionOrmEntity,
    triggers: AutomationTriggerOrmEntity[],
  ): AutomationEntity {
    return AutomationEntity.create({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        organizationId: record.organizationId,
        target: this.targetToDomain(record, revision),
        ownerUserId: record.ownerUserId,
        name: record.name,
        triggers: triggers
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((trigger) => this.triggerToDomain(trigger)),
        pausedAt: record.pausedAt ? new Date(record.pausedAt) : null,
        pausedReason: oneOf<AutomationPausedReason>(AUTOMATION_PAUSED_REASONS, record.pausedReason),
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        overlap: oneOf<AutomationOverlapPolicy>(AUTOMATION_OVERLAP_POLICIES, record.overlap),
        maxRunsPerHour: record.maxRunsPerHour,
        version: record.version,
      },
    });
  }

  /**
   * What the automation's runs start, read from its `runTarget` column: the
   * row says which kind it is, and the CHECK constraints hold the columns
   * each kind needs, so the revision's shape follows the kind and is never
   * guessed from which columns are empty.
   */
  targetToDomain(
    record: AutomationOrmEntity,
    revision: AutomationRevisionOrmEntity,
  ): AutomationTarget {
    const common = {
      id: revision.id,
      number: revision.number,
      prompt: revision.prompt,
      createdByUserId: revision.createdByUserId,
      createdAt: new Date(revision.createdAt),
    };
    if (record.runTarget === 'bot') {
      return {
        kind: 'bot',
        botId: String(record.botId),
        credentialScopes: Array.isArray(record.credentialScopes)
          ? record.credentialScopes.filter((scope): scope is Scope =>
              (SCOPES as readonly string[]).includes(scope),
            )
          : null,
        revision: { kind: 'bot', ...common },
      };
    }
    const repositories: AutomationRepository[] = Array.isArray(revision.repositories)
      ? revision.repositories.map((item) => {
          const repository = asRecord(item);
          return {
            installationId: String(repository.installationId ?? ''),
            githubRepoId: String(repository.githubRepoId ?? ''),
            fullName: String(repository.fullName ?? ''),
          };
        })
      : [];
    return {
      kind: 'session',
      projectId: String(record.projectId),
      revision: {
        kind: 'session',
        ...common,
        place: oneOf<AutomationPlace>(AUTOMATION_PLACES, revision.place) ?? 'host',
        hostId: revision.hostId,
        agent: String(revision.agent),
        model: revision.model,
        permission: revision.permission === 'full' ? 'full' : 'auto',
        effort: revision.effort,
        repositories,
      },
    };
  }

  triggerToDomain(record: AutomationTriggerOrmEntity): AutomationTriggerProps {
    const config = asRecord(record.config);
    if (record.source === 'schedule') {
      const schedule: ScheduleTriggerConfig = {
        frequency: oneOf<ScheduleFrequency>(SCHEDULE_FREQUENCIES, config.frequency) ?? 'daily',
        hour: Number(config.hour ?? 9),
        minute: Number(config.minute ?? 0),
        ...(Array.isArray(config.days) ? { days: config.days.map(Number) } : {}),
        ...(typeof config.dayOfMonth === 'number' ? { dayOfMonth: config.dayOfMonth } : {}),
        ...(typeof config.date === 'string' ? { date: config.date } : {}),
      };
      return {
        id: record.id,
        position: record.position,
        source: 'schedule',
        eventType: 'schedule',
        config: schedule,
        timezone: record.timezone ?? 'UTC',
        nextFireAt: record.nextFireAt ? new Date(record.nextFireAt) : null,
      };
    }
    const filter = asRecord(config.filter);
    return {
      id: record.id,
      position: record.position,
      source: 'github',
      eventType: record.eventType,
      config: {
        repositories: Array.isArray(config.repositories) ? config.repositories.map(String) : [],
        filter:
          filter.op === 'equals' && typeof filter.value === 'string'
            ? ({ op: 'equals', value: filter.value } satisfies TriggerFilter)
            : { op: 'any' },
      },
      timezone: null,
      nextFireAt: null,
    };
  }

  toRecord(entity: AutomationEntity): Omit<AutomationOrmEntity, 'createdAt' | 'updatedAt'> {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      ...this.targetToRecord(entity.target),
      ownerUserId: entity.ownerUserId,
      name: entity.name,
      currentRevisionId: entity.revision.id,
      pausedAt: entity.pausedAt,
      pausedReason: entity.pausedReason,
      deletedAt: entity.deletedAt,
      overlap: entity.overlap,
      maxRunsPerHour: entity.maxRunsPerHour,
      version: entity.version,
    };
  }

  /** The target's own columns: a routine has no project, a session automation no bot. */
  private targetToRecord(
    target: AutomationTarget,
  ): Pick<AutomationOrmEntity, 'projectId' | 'runTarget' | 'botId' | 'credentialScopes'> {
    return target.kind === 'bot'
      ? {
          projectId: null,
          runTarget: 'bot',
          botId: target.botId,
          credentialScopes: target.credentialScopes ? [...target.credentialScopes] : null,
        }
      : { projectId: target.projectId, runTarget: 'session', botId: null, credentialScopes: null };
  }

  revisionToRecord(entity: AutomationEntity): Omit<AutomationRevisionOrmEntity, 'createdAt'> {
    const { revision } = entity.target;
    const common = {
      id: revision.id,
      organizationId: entity.organizationId,
      automationId: entity.id,
      number: revision.number,
      prompt: revision.prompt,
      createdByUserId: revision.createdByUserId,
    };
    if (revision.kind === 'bot') {
      return {
        ...common,
        place: 'host',
        hostId: null,
        agent: null,
        model: null,
        permission: 'auto',
        effort: null,
        repositories: [],
      };
    }
    return {
      ...common,
      place: revision.place,
      hostId: revision.hostId,
      agent: revision.agent,
      model: revision.model,
      permission: revision.permission,
      effort: revision.effort,
      repositories: revision.repositories,
    };
  }

  triggerToRecord(
    entity: AutomationEntity,
    trigger: AutomationTriggerProps,
  ): Omit<AutomationTriggerOrmEntity, 'createdAt' | 'updatedAt'> {
    return {
      id: trigger.id,
      organizationId: entity.organizationId,
      automationId: entity.id,
      position: trigger.position,
      source: trigger.source,
      eventType: trigger.eventType,
      config: trigger.config as unknown as Record<string, unknown>,
      timezone: trigger.timezone,
      nextFireAt: trigger.nextFireAt,
    };
  }

  /** The subjects a trigger watches, as `automation_trigger_subject` rows. */
  subjectsOf(trigger: AutomationTriggerProps): { subjectKind: string; subjectRef: string }[] {
    if (trigger.source === 'schedule') return [];
    return trigger.config.repositories.map((ref) => ({
      subjectKind: 'repository',
      subjectRef: ref,
    }));
  }

  toResponse(
    entity: AutomationEntity,
    viewerId: string,
    digest: AutomationRunDigest | undefined,
  ): AutomationResponseDto {
    const dto = new AutomationResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    const target = sessionTargetOf(entity);
    dto.projectId = target.projectId;
    dto.ownerUserId = entity.ownerUserId;
    dto.ownedByMe = entity.ownerUserId === viewerId;
    dto.name = entity.name;
    dto.status = digest?.running ? 'running' : entity.isPaused ? 'paused' : 'active';
    dto.pausedAt = entity.pausedAt;
    dto.pausedReason = entity.pausedReason;
    dto.nextRunAt = entity.isPaused ? null : entity.nextRunAt();
    dto.revision = this.revisionToResponse(target.revision);
    dto.triggers = entity.triggers.map((trigger) => this.triggerToResponse(trigger));
    dto.overlap = entity.overlap;
    dto.maxRunsPerHour = entity.maxRunsPerHour;
    dto.version = entity.version;
    dto.runCount = digest?.runCount ?? 0;
    dto.lastRuns = (digest?.lastRuns ?? []).map((run) => this.runs.toSummary(run));
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  /** A bot's routine as its Routines tab reads it: a prompt and when, no host or project. */
  toRoutineResponse(
    entity: AutomationEntity,
    digest: AutomationRunDigest | undefined,
  ): BotRoutineResponseDto {
    const dto = new BotRoutineResponseDto();
    dto.id = entity.id;
    dto.botId = botTargetOf(entity).botId;
    dto.name = entity.name;
    dto.prompt = entity.revision.prompt;
    dto.status = digest?.running ? 'running' : entity.isPaused ? 'paused' : 'active';
    dto.pausedReason = entity.pausedReason;
    dto.nextRunAt = entity.isPaused ? null : entity.nextRunAt();
    dto.triggers = entity.triggers.map((trigger) => this.triggerToResponse(trigger));
    const [last] = digest?.lastRuns ?? [];
    dto.lastRun = last ? this.runs.toSummary(last) : null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  private revisionToResponse(revision: SessionRevisionProps): AutomationRevisionResponseDto {
    const dto = new AutomationRevisionResponseDto();
    dto.id = revision.id;
    dto.number = revision.number;
    dto.place = revision.place;
    dto.hostId = revision.hostId;
    dto.agent = revision.agent;
    dto.model = revision.model;
    dto.permission = revision.permission as AutomationPermission;
    dto.effort = revision.effort;
    dto.prompt = revision.prompt;
    dto.repositories = revision.repositories.map((repository) => {
      const row = new AutomationRepositoryResponseDto();
      row.installationId = repository.installationId;
      row.githubRepoId = repository.githubRepoId;
      row.fullName = repository.fullName;
      return row;
    });
    dto.createdAt = revision.createdAt;
    return dto;
  }

  private triggerToResponse(trigger: AutomationTriggerProps): AutomationTriggerResponseDto {
    const dto = new AutomationTriggerResponseDto();
    dto.id = trigger.id;
    dto.position = trigger.position;
    dto.source = trigger.source;
    dto.event = trigger.eventType;
    dto.nextFireAt = trigger.nextFireAt;
    if (trigger.source === 'schedule') {
      const { days, ...schedule } = trigger.config;
      dto.schedule = {
        ...schedule,
        ...(days ? { days: [...days] } : {}),
        timezone: trigger.timezone,
      };
    } else {
      dto.repositories = trigger.config.repositories;
      dto.filter = trigger.config.filter;
    }
    return dto;
  }
}

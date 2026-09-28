import {
  type AutomationResponseDto,
  type AutomationRunResponseDto,
  type AutomationTriggerResponseDto,
  type CreateAutomationRequest,
  heyApiSdk,
  type UpdateAutomationRequest,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import type { TriggerFilter } from '@oppenheimer/shared/automations';
import { injectable } from 'inversify';
import {
  AutomationEntity,
  type AutomationInput,
  AutomationRunEntity,
  type AutomationTrigger,
  type RunHistory,
  type RunHistoryFilter,
  type RunPage,
  type RunsFilter,
  type TriggerInput,
  type TriggerPreview,
  type UpdateAutomationInput,
} from './automation.entity';
import { AutomationsErrors } from './automations.errors';

function date(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function filterOf(dto: AutomationTriggerResponseDto['filter']): TriggerFilter {
  return dto?.op === 'equals' && dto.value ? { op: 'equals', value: dto.value } : { op: 'any' };
}

function triggerOf(dto: AutomationTriggerResponseDto): AutomationTrigger | null {
  if (dto.source === 'schedule' && dto.schedule) {
    const { timezone, ...rule } = dto.schedule;
    return { source: 'schedule', id: dto.id, ...rule, timezone, nextFireAt: date(dto.nextFireAt) };
  }
  if (dto.source === 'github' && dto.event !== 'schedule') {
    return {
      source: 'github',
      id: dto.id,
      event: dto.event,
      repositories: dto.repositories ?? [],
      filter: filterOf(dto.filter),
    };
  }
  return null;
}

function toEntity(dto: AutomationResponseDto): AutomationEntity {
  return new AutomationEntity(
    dto.id,
    dto.projectId,
    dto.name,
    dto.ownedByMe,
    dto.status,
    date(dto.pausedAt),
    dto.pausedReason ?? null,
    date(dto.nextRunAt),
    {
      id: dto.revision.id,
      number: dto.revision.number,
      hostId: dto.revision.hostId,
      agent: isCodingAgentId(dto.revision.agent) ? dto.revision.agent : 'claude-code',
      model: dto.revision.model ?? null,
      permission: dto.revision.permission,
      effort: dto.revision.effort ?? null,
      prompt: dto.revision.prompt,
      repositories: dto.revision.repositories,
      createdAt: new Date(dto.revision.createdAt),
    },
    dto.triggers.flatMap((trigger) => triggerOf(trigger) ?? []),
    dto.overlap ?? null,
    dto.maxRunsPerHour ?? null,
    dto.version,
    dto.runCount,
    dto.lastRuns.map((run) => ({
      ...run,
      sessionId: run.sessionId ?? null,
      createdAt: new Date(run.createdAt),
    })),
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
  );
}

function toRunEntity(dto: AutomationRunResponseDto): AutomationRunEntity {
  return new AutomationRunEntity(
    dto.id,
    dto.automationId,
    dto.automationName,
    dto.automationDeleted,
    dto.projectId,
    dto.status,
    dto.outcome,
    dto.skipReason ?? null,
    dto.cause,
    dto.causeSummary,
    dto.title,
    dto.sessionId ?? null,
    dto.branch ?? null,
    dto.revisionNumber,
    dto.agent,
    dto.model ?? null,
    dto.hostId,
    new Date(dto.createdAt),
    date(dto.startedAt),
    date(dto.endedAt),
    dto.durationMs ?? null,
    dto.turn
      ? {
          state: dto.turn.state,
          exitCode: dto.turn.exitCode ?? null,
          result: dto.turn.result ?? null,
          failureDetail: dto.turn.failureDetail ?? null,
          costUsd: dto.turn.costUsd ?? null,
          permissionDenials: dto.turn.permissionDenials,
          prompt: dto.turn.prompt ?? null,
        }
      : null,
  );
}

type TriggerRequest = CreateAutomationRequest['triggers'][number];

function toTriggerRequest(trigger: TriggerInput): TriggerRequest {
  if (trigger.source === 'schedule') {
    return {
      source: 'schedule',
      frequency: trigger.frequency,
      hour: trigger.hour,
      minute: trigger.minute,
      timezone: trigger.timezone,
      ...(trigger.days ? { days: trigger.days } : {}),
      ...(trigger.dayOfMonth !== undefined ? { dayOfMonth: trigger.dayOfMonth } : {}),
      ...(trigger.date ? { date: trigger.date } : {}),
    };
  }
  return {
    source: 'github',
    event: trigger.event,
    repositories: trigger.repositories,
    filter: trigger.filter,
  };
}

function toCreateRequest(input: AutomationInput): CreateAutomationRequest {
  return {
    projectId: input.projectId,
    repositories: input.repositories,
    hostId: input.hostId,
    name: input.name,
    triggers: input.triggers.map(toTriggerRequest),
    prompt: input.prompt,
    agent: input.agent,
    ...(input.launch ? { launch: input.launch } : {}),
  };
}

function toUpdateRequest(input: UpdateAutomationInput): UpdateAutomationRequest {
  const { triggers, ...rest } = input;
  return { ...rest, ...(triggers ? { triggers: triggers.map(toTriggerRequest) } : {}) };
}

@injectable()
export class AutomationsRepository {
  @MapApiError(AutomationsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<AutomationEntity[]> {
    const data = await unwrapBody(heyApiSdk.findAutomations(), AutomationsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  @MapApiError(AutomationsErrors.FETCH_FAILED)
  async findById(id: string): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.findAutomation({ path: { id } }),
      AutomationsErrors.FETCH_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.SAVE_FAILED)
  async create(input: AutomationInput): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.createAutomation({ body: toCreateRequest(input) }),
      AutomationsErrors.SAVE_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.SAVE_FAILED)
  async update(id: string, input: UpdateAutomationInput): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateAutomation({
        path: { id },
        body: toUpdateRequest(input),
      }),
      AutomationsErrors.SAVE_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.ACTION_FAILED)
  async pause(id: string): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.pauseAutomation({ path: { id } }),
      AutomationsErrors.ACTION_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.ACTION_FAILED)
  async resume(id: string): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.resumeAutomation({ path: { id } }),
      AutomationsErrors.ACTION_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.ACTION_FAILED)
  async duplicate(id: string): Promise<AutomationEntity> {
    const data = await unwrapBody(
      heyApiSdk.duplicateAutomation({ path: { id } }),
      AutomationsErrors.ACTION_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(AutomationsErrors.DELETE_FAILED)
  async remove(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteAutomation({ path: { id } }), AutomationsErrors.DELETE_FAILED);
  }

  /** Run now. The key makes a retried click the same run. */
  @MapApiError(AutomationsErrors.RUN_FAILED)
  async run(id: string, idempotencyKey: string): Promise<AutomationRunEntity> {
    const data = await unwrapBody(
      heyApiSdk.runAutomation({
        path: { id },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      AutomationsErrors.RUN_FAILED,
    );
    return toRunEntity(data);
  }

  @MapApiError(AutomationsErrors.FETCH_RUNS_FAILED)
  async findRuns(filter: RunsFilter): Promise<RunPage> {
    const data = await unwrapBody(
      heyApiSdk.findAutomationRuns({
        query: {
          ...(filter.automationId ? { automationId: filter.automationId } : {}),
          ...(filter.projectId ? { projectId: filter.projectId } : {}),
          ...(filter.statuses?.length ? { status: filter.statuses.join(',') } : {}),
          ...(filter.window ? { window: filter.window } : {}),
          ...(filter.page ? { page: filter.page } : {}),
          ...(filter.limit ? { limit: filter.limit } : {}),
        },
      }),
      AutomationsErrors.FETCH_RUNS_FAILED,
    );
    return { ...data, items: data.items.map(toRunEntity) };
  }

  @MapApiError(AutomationsErrors.FETCH_HISTORY_FAILED)
  async history(filter: RunHistoryFilter): Promise<RunHistory> {
    const data = await unwrapBody(
      heyApiSdk.findRunHistory({
        query: {
          timezone: filter.timezone,
          ...(filter.automationId ? { automationId: filter.automationId } : {}),
          ...(filter.projectId ? { projectId: filter.projectId } : {}),
          ...(filter.days ? { days: filter.days } : {}),
        },
      }),
      AutomationsErrors.FETCH_HISTORY_FAILED,
    );
    return data;
  }

  /** What a GitHub card would have matched in the last week, before it is saved. */
  @MapApiError(AutomationsErrors.PREVIEW_FAILED)
  async previewTrigger(
    trigger: Extract<TriggerInput, { source: 'github' }>,
  ): Promise<TriggerPreview> {
    const data = await unwrapBody(
      heyApiSdk.previewTrigger({
        body: {
          source: 'github',
          event: trigger.event,
          repositories: trigger.repositories,
          filter: trigger.filter,
        },
      }),
      AutomationsErrors.PREVIEW_FAILED,
    );
    return {
      ...data,
      matches: data.matches.map((match) => ({ ...match, occurredAt: new Date(match.occurredAt) })),
    };
  }
}

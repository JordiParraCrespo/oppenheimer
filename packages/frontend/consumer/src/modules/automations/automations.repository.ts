import {
  type AutomationResponseDto,
  type AutomationRunResponseDto,
  type AutomationTriggerResponseDto,
  type CreateAutomationRequest,
  heyApiSdk,
  type UpdateAutomationRequest,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import type { TriggerFilter } from '@oppenheimer/shared/automations';
import { CLOUD_AGENT_IDS } from '@oppenheimer/shared/schemas/cloud-agent';
import { injectable } from 'inversify';
import {
  type AutomationAgentId,
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

/** A saved trigger as the console reads it; a kind this client does not know reads as none. */
export function triggerOf(dto: AutomationTriggerResponseDto): AutomationTrigger | null {
  if (dto.source === 'schedule' && dto.schedule) {
    const { timezone, ...rule } = dto.schedule;
    return { source: 'schedule', id: dto.id, ...rule, timezone, nextFireAt: date(dto.nextFireAt) };
  }
  if (dto.source === 'github' && dto.event !== 'schedule' && dto.event !== 'mail_received') {
    return {
      source: 'github',
      id: dto.id,
      event: dto.event,
      repositories: dto.repositories ?? [],
      filter: filterOf(dto.filter),
    };
  }
  if (dto.source === 'gmail' && dto.event === 'mail_received' && dto.connectionId) {
    return {
      source: 'gmail',
      id: dto.id,
      event: 'mail_received',
      connectionId: dto.connectionId,
      query: dto.query ?? null,
    };
  }
  return null;
}

/** A revision's agent, narrowed once: an id this build does not know reads as Claude Code. */
function agentOf(agent: string): AutomationAgentId {
  if (isCodingAgentId(agent)) return agent;
  return (CLOUD_AGENT_IDS as readonly string[]).includes(agent)
    ? (agent as AutomationAgentId)
    : 'claude-code';
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
      place: dto.revision.place,
      hostId: dto.revision.hostId ?? null,
      agent: agentOf(dto.revision.agent),
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
    dto.projectId ?? null,
    dto.status,
    dto.outcome,
    dto.skipReason ?? null,
    dto.cause,
    dto.causeSummary,
    dto.title,
    dto.sessionId ?? null,
    dto.branch ?? null,
    dto.revisionNumber,
    dto.agent ?? null,
    dto.model ?? null,
    dto.hostId ?? null,
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
  if (trigger.source === 'gmail') {
    return {
      source: 'gmail',
      event: trigger.event,
      connectionId: trigger.connectionId,
      query: trigger.query,
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
    place: input.place,
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
  findAll(): Promise<AutomationEntity[]> {
    return callApi(AutomationsErrors.FETCH_LIST_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findAutomations());
      return data.map(toEntity);
    });
  }

  findById(id: string): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findAutomation({ path: { id } }));
      return toEntity(data);
    });
  }

  create(input: AutomationInput): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.SAVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createAutomation({ body: toCreateRequest(input) }));
      return toEntity(data);
    });
  }

  update(id: string, input: UpdateAutomationInput): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.SAVE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.updateAutomation({
          path: { id },
          body: toUpdateRequest(input),
        }),
      );
      return toEntity(data);
    });
  }

  pause(id: string): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.ACTION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.pauseAutomation({ path: { id } }));
      return toEntity(data);
    });
  }

  resume(id: string): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.ACTION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.resumeAutomation({ path: { id } }));
      return toEntity(data);
    });
  }

  duplicate(id: string): Promise<AutomationEntity> {
    return callApi(AutomationsErrors.ACTION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.duplicateAutomation({ path: { id } }));
      return toEntity(data);
    });
  }

  remove(id: string): Promise<void> {
    return callApi(AutomationsErrors.DELETE_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteAutomation({ path: { id } }));
    });
  }

  /** Run now. The key makes a retried click the same run. */
  run(id: string, idempotencyKey: string): Promise<AutomationRunEntity> {
    return callApi(AutomationsErrors.RUN_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.runAutomation({
          path: { id },
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      );
      return toRunEntity(data);
    });
  }

  findRuns(filter: RunsFilter): Promise<RunPage> {
    return callApi(AutomationsErrors.FETCH_RUNS_FAILED, async (api) => {
      const data = await api.body(
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
      );
      return { ...data, items: data.items.map(toRunEntity) };
    });
  }

  history(filter: RunHistoryFilter): Promise<RunHistory> {
    return callApi(AutomationsErrors.FETCH_HISTORY_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.findRunHistory({
          query: {
            timezone: filter.timezone,
            ...(filter.automationId ? { automationId: filter.automationId } : {}),
            ...(filter.projectId ? { projectId: filter.projectId } : {}),
            ...(filter.days ? { days: filter.days } : {}),
          },
        }),
      );
      return data;
    });
  }

  /** What a GitHub card would have matched in the last week, before it is saved. */
  previewTrigger(trigger: Extract<TriggerInput, { source: 'github' }>): Promise<TriggerPreview> {
    return callApi(AutomationsErrors.PREVIEW_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.previewTrigger({
          body: {
            source: 'github',
            event: trigger.event,
            repositories: trigger.repositories,
            filter: trigger.filter,
          },
        }),
      );
      return {
        ...data,
        matches: data.matches.map((match) => ({
          ...match,
          occurredAt: new Date(match.occurredAt),
        })),
      };
    });
  }
}

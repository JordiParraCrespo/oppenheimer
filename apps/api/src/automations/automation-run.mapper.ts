import { Injectable } from '@nestjs/common';
import type { CreateSessionDto, SessionEffortDto } from '@oppenheimer/shared';
import { SESSION_EFFORTS } from '@oppenheimer/shared';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import {
  AUTOMATION_RUN_CAUSES,
  AUTOMATION_RUN_OUTCOMES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_SKIP_REASONS,
  type AutomationRunCause,
  type AutomationRunOutcome,
  type AutomationRunStatus,
  type AutomationSkipReason,
} from '@oppenheimer/shared/automations';
import type { StoredExternalEvent } from '../inbound-events/domain/external-event.types';
import type { AutomationRunOrmEntity } from './database/automation-run.orm-entity';
import type { AutomationEntity } from './domain/automation.entity';
import type { RunReadModel } from './domain/automation-read.types';
import { AutomationRunEntity, type RunCauseSummary } from './domain/automation-run.entity';
import type { RunCheckout, RunEventView } from './domain/run-launch.policy';
import { AutomationRunSummaryResponseDto } from './dtos/automation.response.dto';
import {
  AutomationRunResponseDto,
  RunCauseResponseDto,
  RunTurnResponseDto,
  TriggerPreviewMatchResponseDto,
} from './dtos/automation-run.response.dto';

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return (values as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function date(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The run aggregate and its read model, to and from rows and responses. */
@Injectable()
export class AutomationRunMapper {
  toDomain(record: AutomationRunOrmEntity): AutomationRunEntity {
    return AutomationRunEntity.create({
      id: record.id,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      props: {
        organizationId: record.organizationId,
        automationId: record.automationId,
        revisionId: record.revisionId,
        triggerId: record.triggerId,
        cause: oneOf<AutomationRunCause>(AUTOMATION_RUN_CAUSES, record.cause, 'manual'),
        causeKey: record.causeKey,
        causeSummary: this.causeSummaryOf(record.causeSummary),
        inboundEventId: record.inboundEventId,
        scheduledFor: date(record.scheduledFor),
        outcome: oneOf<AutomationRunOutcome>(AUTOMATION_RUN_OUTCOMES, record.outcome, 'pending'),
        skipReason: record.skipReason
          ? oneOf<AutomationSkipReason>(
              AUTOMATION_SKIP_REASONS,
              record.skipReason,
              'not_launchable',
            )
          : null,
        availableAt: new Date(record.availableAt),
        attempts: record.attempts,
        sessionId: record.sessionId,
        requestedByUserId: record.requestedByUserId,
        dispatchedAt: date(record.dispatchedAt),
      },
    });
  }

  toRecord(run: AutomationRunEntity): Omit<AutomationRunOrmEntity, 'createdAt' | 'updatedAt'> {
    return {
      id: run.id,
      organizationId: run.organizationId,
      automationId: run.automationId,
      revisionId: run.revisionId,
      triggerId: run.triggerId,
      cause: run.cause,
      causeKey: run.causeKey,
      causeSummary: { ...run.causeSummary },
      inboundEventId: run.inboundEventId,
      scheduledFor: run.scheduledFor,
      outcome: run.outcome,
      skipReason: run.skipReason,
      availableAt: run.availableAt,
      attempts: run.attempts,
      sessionId: run.sessionId,
      requestedByUserId: run.requestedByUserId,
      dispatchedAt: run.dispatchedAt,
    };
  }

  /**
   * The session a run starts, in the create route's own words: the revision's
   * host, agent and engine, the repository and branch the event decided, and
   * the composed prompt.
   */
  toSessionInput(
    automation: AutomationEntity,
    checkout: RunCheckout,
    prompt: string,
  ): CreateSessionDto {
    const revision = automation.revision;
    if (!isCodingAgentId(revision.agent)) {
      throw new Error(`Automation ${automation.id} names an agent this build does not know`);
    }
    const effort = (SESSION_EFFORTS as readonly string[]).includes(revision.effort ?? '')
      ? (revision.effort as SessionEffortDto)
      : undefined;
    return {
      hostId: revision.hostId,
      agent: revision.agent,
      projectId: automation.projectId,
      checkouts: [
        {
          installationId: checkout.repository.installationId,
          githubRepoId: Number(checkout.repository.githubRepoId),
          ...(checkout.baseBranch ? { baseBranch: checkout.baseBranch } : {}),
        },
      ],
      launch: {
        ...(revision.model ? { model: revision.model } : {}),
        permission: revision.permission,
        ...(effort ? { effort } : {}),
      },
      prompt,
    };
  }

  /** One event the trigger preview lists: "#124 · Harden API config loading · jordiparra · 2h ago". */
  toPreviewMatch(event: StoredExternalEvent): TriggerPreviewMatchResponseDto {
    const dto = new TriggerPreviewMatchResponseDto();
    dto.repository = event.subject.name;
    dto.ref = optionalText(event.context.ref);
    dto.title = optionalText(event.context.title);
    dto.actor = event.actor.login ?? undefined;
    dto.url = optionalText(event.context.url);
    dto.occurredAt = event.occurredAt;
    return dto;
  }

  /** The hub's stored event, as the launch policies read it. */
  eventViewOf(event: StoredExternalEvent): RunEventView {
    return {
      type: event.type,
      source: event.source,
      subjectRef: event.subject.ref,
      subjectName: event.subject.name,
      actorLogin: event.actor.login,
      attributes: event.attributes,
      context: event.context,
    };
  }

  causeSummaryOf(value: unknown): RunCauseSummary {
    const summary = asRecord(value);
    return {
      label: optionalText(summary.label) ?? 'Run',
      text: optionalText(summary.text) ?? '',
      ref: optionalText(summary.ref),
      actor: optionalText(summary.actor),
      url: optionalText(summary.url),
      eventType: optionalText(summary.eventType) ?? 'manual',
    };
  }

  /**
   * A raw row of the runs read model (`AutomationRunRepository`'s one select)
   * into its typed shape. The status is already derived in SQL.
   */
  readModelOf(row: Json): RunReadModel {
    const turnState = optionalText(row.turnState);
    return {
      id: String(row.id),
      automationId: String(row.automationId),
      automationName: String(row.automationName ?? ''),
      automationDeleted: row.automationDeletedAt !== null && row.automationDeletedAt !== undefined,
      projectId: String(row.projectId),
      status: oneOf<AutomationRunStatus>(AUTOMATION_RUN_STATUSES, row.status, 'queued'),
      outcome: oneOf<AutomationRunOutcome>(AUTOMATION_RUN_OUTCOMES, row.outcome, 'pending'),
      skipReason: row.skipReason
        ? oneOf<AutomationSkipReason>(AUTOMATION_SKIP_REASONS, row.skipReason, 'not_launchable')
        : null,
      cause: oneOf<AutomationRunCause>(AUTOMATION_RUN_CAUSES, row.cause, 'manual'),
      causeSummary: this.causeSummaryOf(row.causeSummary),
      sessionId: optionalText(row.sessionId) ?? null,
      sessionName: optionalText(row.sessionName) ?? null,
      sessionNamed: row.sessionNameSource !== null && row.sessionNameSource !== undefined,
      branch: optionalText(row.branch) ?? null,
      revisionNumber: Number(row.revisionNumber ?? 1),
      agent: String(row.agent ?? ''),
      model: optionalText(row.model) ?? null,
      hostId: String(row.hostId ?? ''),
      createdAt: date(row.createdAt) ?? new Date(0),
      scheduledFor: date(row.scheduledFor),
      dispatchedAt: date(row.dispatchedAt),
      turn: turnState
        ? {
            state: turnState,
            startedAt: date(row.turnStartedAt),
            endedAt: date(row.turnEndedAt),
            exitCode: typeof row.turnExitCode === 'number' ? row.turnExitCode : null,
            result: optionalText(row.turnResult) ?? null,
            failureDetail: optionalText(row.turnFailureDetail) ?? null,
            costUsd:
              row.turnCostUsd === null || row.turnCostUsd === undefined
                ? null
                : Number(row.turnCostUsd),
            permissionDenials: Number(row.turnPermissionDenials ?? 0),
            prompt: optionalText(row.turnPrompt) ?? null,
          }
        : null,
    };
  }

  /**
   * What a run is called: the name the agent gave its session, and until it
   * has one, the automation's name and what started it ("Nightly audit · manual run").
   */
  titleOf(run: RunReadModel): string {
    if (run.sessionNamed && run.sessionName) return run.sessionName;
    const cause = run.cause === 'manual' ? 'manual run' : run.causeSummary.label.toLowerCase();
    return `${run.automationName} · ${cause}`;
  }

  toSummary(run: RunReadModel): AutomationRunSummaryResponseDto {
    const dto = new AutomationRunSummaryResponseDto();
    dto.id = run.id;
    dto.title = this.titleOf(run);
    dto.status = run.status;
    dto.createdAt = run.createdAt;
    return dto;
  }

  toResponse(run: RunReadModel): AutomationRunResponseDto {
    const dto = new AutomationRunResponseDto();
    dto.id = run.id;
    dto.automationId = run.automationId;
    dto.automationName = run.automationName;
    dto.automationDeleted = run.automationDeleted;
    dto.projectId = run.projectId;
    dto.status = run.status;
    dto.outcome = run.outcome;
    dto.skipReason = run.skipReason;
    dto.cause = run.cause;
    dto.causeSummary = Object.assign(new RunCauseResponseDto(), run.causeSummary);
    dto.title = this.titleOf(run);
    dto.sessionId = run.sessionId;
    dto.branch = run.branch;
    dto.revisionNumber = run.revisionNumber;
    dto.agent = run.agent;
    dto.model = run.model;
    dto.hostId = run.hostId;
    dto.createdAt = run.createdAt;
    dto.scheduledFor = run.scheduledFor;
    dto.dispatchedAt = run.dispatchedAt;
    dto.startedAt = run.turn?.startedAt ?? null;
    dto.endedAt = run.turn?.endedAt ?? null;
    dto.durationMs =
      dto.startedAt && dto.endedAt ? dto.endedAt.getTime() - dto.startedAt.getTime() : null;
    dto.turn = run.turn
      ? Object.assign(new RunTurnResponseDto(), {
          state: run.turn.state,
          exitCode: run.turn.exitCode,
          result: run.turn.result,
          failureDetail: run.turn.failureDetail,
          costUsd: run.turn.costUsd,
          permissionDenials: run.turn.permissionDenials,
          prompt: run.turn.prompt,
        })
      : null;
    return dto;
  }
}

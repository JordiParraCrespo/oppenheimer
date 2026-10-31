import { posix } from 'node:path';
import { Injectable } from '@nestjs/common';
import { toPageMeta } from '@oppenheimer/backend-core';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { type SessionDecision, sessionDecisionSchema } from '@oppenheimer/shared';
import type { HostCodexEnvironments } from './application/host-codex-environments.port';
import type { HostFolderListing } from './application/host-folders.port';
import type { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import type { SessionCloudRunOrmEntity } from './database/session-cloud-run.orm-entity';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import type { RecentFolder, SessionListPage } from './database/work-session.repository.port';
import { encodeSessionListCursor } from './domain/session-list-cursor.policy';
import {
  launchPermissionFor,
  type SessionAgent,
  type SessionFold,
} from './domain/session-state.policy';
import { SESSION_ORIGINS } from './domain/session-turn.policy';
import { WorkSessionEntity } from './domain/work-session.entity';
import { HostCodexEnvironmentsResponseDto } from './dtos/host-codex-environments.response.dto';
import { HostFoldersResponseDto } from './dtos/host-folders.response.dto';
import { SessionPageMetaDto, SessionResponseDto } from './dtos/session.response.dto';
import type { SessionDecisionResponseDto } from './dtos/session-decision.response.dto';
import { SessionCheckoutMapper } from './session-checkout.mapper';
import { SessionCloudRunMapper } from './session-cloud-run.mapper';

/**
 * The session's root row across the boundary, and the aggregate assembled from
 * it: its checkouts and its cloud run each cross with their own mapper
 * (`SessionCheckoutMapper`, `SessionCloudRunMapper`), as do its turns and its
 * log entries (`SessionTurnMapper`, `WorkSessionEventMapper`), which the
 * repository reads apart from the session.
 *
 * `state` on the wire is the **derived group**, not the stored lifecycle: the
 * committed client contract (the sidebar shows what needs you). It is computed from
 * the row alone, every input being a column the fold projects, so a listing needs no
 * log walk and a mapper cannot be handed an observation the log never recorded.
 */
@Injectable()
export class WorkSessionMapper
  implements Mapper<WorkSessionEntity, WorkSessionOrmEntity, SessionResponseDto>
{
  toPersistence(entity: WorkSessionEntity): WorkSessionOrmEntity {
    const record = new WorkSessionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.projectId = entity.projectId;
    record.createdByUserId = entity.createdByUserId;
    record.hostId = entity.hostId;
    record.name = entity.name;
    record.nameSource = entity.nameSource;
    record.slug = entity.slug;
    record.agent = entity.agent;
    record.place = entity.place;
    record.folderPath = entity.folderPath;
    record.idempotencyKey = entity.idempotencyKey;
    record.origin = entity.origin;
    const fold = entity.fold;
    record.state = fold.state;
    record.stateSeq = fold.stateSeq;
    record.agentSessionId = fold.agentSessionId;
    record.lastEventAt = fold.lastEventAt;
    record.stoppedAt = fold.stoppedAt;
    record.cwdCheckoutId = fold.cwdCheckoutId;
    record.lastObservedState = fold.lastObservedState;
    record.observedSince = fold.observedSince;
    record.reportHash = fold.reportHash;
    record.ackedReportHash = fold.ackedReportHash;
    record.launchModel = fold.launch.model;
    record.launchPermission = fold.launch.permission;
    record.launchEffort = fold.launch.effort;
    record.launchEnvironment = fold.launch.environment;
    record.closeRequestedAt = fold.closeRequest?.requestedAt ?? null;
    record.closeAcceptsUnpushedWork = fold.closeRequest?.acceptUnpushedWork ?? false;
    record.closeRefusalCode = fold.closeRefusal?.code ?? null;
    record.closeRefusalDetail = fold.closeRefusal?.detail ?? null;
    record.pendingDecision = fold.pendingDecision;
    return record;
  }

  toDomain(
    record: WorkSessionOrmEntity,
    checkouts: SessionCheckoutOrmEntity[] = [],
    cloudRun: SessionCloudRunOrmEntity | null = null,
  ): WorkSessionEntity {
    const session = WorkSessionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        createdByUserId: record.createdByUserId,
        hostId: record.hostId,
        slug: record.slug,
        agent: record.agent as SessionAgent,
        // The row's CHECKs hold the place and the folder to each other.
        place: record.place,
        folderPath: record.folderPath,
        idempotencyKey: record.idempotencyKey,
        checkouts: [],
        cloudRun: cloudRun ? SessionCloudRunMapper.toDomain(cloudRun) : null,
        origin: (SESSION_ORIGINS as readonly string[]).includes(record.origin)
          ? record.origin
          : 'person',
        // Loaded by the repository when it folds, under the row lock.
        latestTurn: null,
        ...this.foldOf(record),
        // After the fold: on a row the listed project is never null.
        projectId: record.projectId,
      },
    });
    for (const checkout of checkouts)
      session.attachCheckout(SessionCheckoutMapper.toDomain(checkout));
    return session;
  }

  /**
   * The stored decision, read back through its schema: a `jsonb` value is only as
   * typed as whatever wrote it, and one this build cannot read is no decision.
   */
  decisionOf(value: unknown): SessionDecision | null {
    if (value === null || value === undefined) return null;
    const parsed = sessionDecisionSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  /** One row of the recent-folders aggregate; the driver returns the `max` as a `Date`. */
  recentFolderOf(row: unknown): RecentFolder {
    const record = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    const at = record.lastUsedAt;
    return {
      path: String(record.path),
      lastUsedAt: at instanceof Date ? at : new Date(String(at)),
    };
  }

  /**
   * The folder picker's answer: the runner's listing with each entry's path
   * joined on the host's own separator, and the caller's recent folders. Absent
   * branches and an absent `truncated` are spelled out, so a client never has to
   * tell "no" from "not said".
   */
  /** The Codex environment picker's answer, absent labels and recommendation spelled as null. */
  toCodexEnvironmentsResponse(listing: HostCodexEnvironments): HostCodexEnvironmentsResponseDto {
    const dto = new HostCodexEnvironmentsResponseDto();
    dto.environments = listing.environments.map((env) => ({
      id: env.id,
      label: env.label ?? null,
      pinned: env.pinned,
      repository: env.repository,
    }));
    dto.recommended = listing.recommended ?? null;
    dto.source = listing.source;
    return dto;
  }

  toFoldersResponse(listing: HostFolderListing, recent: RecentFolder[]): HostFoldersResponseDto {
    const dto = new HostFoldersResponseDto();
    dto.path = listing.path;
    dto.parent = listing.parent;
    dto.home = listing.home;
    dto.branch = listing.branch ?? null;
    dto.entries = listing.entries.map((entry) => ({
      name: entry.name,
      path: posix.join(listing.path, entry.name),
      branch: entry.branch ?? null,
    }));
    dto.truncated = listing.truncated ?? false;
    dto.recent = recent.map((folder) => ({ path: folder.path, lastUsedAt: folder.lastUsedAt }));
    return dto;
  }

  /**
   * The projection as a value. It is read back whole rather than column by column
   * because the repository re-seats an aggregate on it inside the row lock, and a
   * field missing there would be a column the fold silently stops maintaining.
   */
  foldOf(record: WorkSessionOrmEntity): SessionFold {
    return {
      state: record.state,
      stateSeq: record.stateSeq,
      agentSessionId: record.agentSessionId,
      lastEventAt: record.lastEventAt,
      stoppedAt: record.stoppedAt,
      name: record.name,
      nameSource: record.nameSource,
      cwdCheckoutId: record.cwdCheckoutId,
      lastObservedState: record.lastObservedState,
      observedSince: record.observedSince,
      reportHash: record.reportHash,
      ackedReportHash: record.ackedReportHash,
      launch: {
        model: record.launchModel,
        permission: launchPermissionFor(record.agent, record.launchPermission),
        effort: record.launchEffort,
        environment: record.launchEnvironment,
      },
      projectId: record.projectId,
      closeRequest: record.closeRequestedAt
        ? {
            requestedAt: record.closeRequestedAt,
            acceptUnpushedWork: record.closeAcceptsUnpushedWork,
          }
        : null,
      closeRefusal: record.closeRefusalCode
        ? { code: record.closeRefusalCode, detail: record.closeRefusalDetail }
        : null,
      pendingDecision: this.decisionOf(record.pendingDecision),
    };
  }

  toPageMeta(page: SessionListPage): SessionPageMetaDto {
    const meta = new SessionPageMetaDto();
    meta.limit = page.limit;
    meta.nextCursor = page.nextCursor ? encodeSessionListCursor(page.nextCursor) : null;
    if (page.total !== undefined && page.page !== undefined) {
      Object.assign(meta, toPageMeta({ count: page.total, page: page.page, limit: page.limit }));
    }
    return meta;
  }

  /**
   * `hints` rides the session rather than a second envelope because the console
   * renders the row it just changed.
   */
  toResponse(
    entity: WorkSessionEntity,
    options: { now?: Date; hints?: string[] } = {},
  ): SessionResponseDto {
    const now = options.now ?? new Date();
    const dto = new SessionResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.projectId = entity.projectId;
    dto.hostId = entity.hostId;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.agent = entity.agent;
    dto.place = entity.place;
    dto.folderPath = entity.folderPath;
    dto.cloudSessionId = entity.cloudSessionId;
    dto.launch = {
      model: entity.launch.model,
      permission: entity.launch.permission,
      effort: entity.launch.effort,
    };
    dto.state = entity.group(now);
    dto.lifecycle = entity.state;
    dto.cwdCheckoutId = entity.cwdCheckoutId;
    dto.agentSessionId = entity.agentSessionId;
    dto.lastEventAt = entity.lastEventAt;
    dto.observedSince = entity.fold.observedSince;
    dto.stateSeq = entity.stateSeq;
    dto.stoppedAt = entity.stoppedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.hints = options.hints ?? [];
    const { closeRequest, closeRefusal } = entity;
    dto.closeRequest = closeRequest
      ? {
          requestedAt: closeRequest.requestedAt,
          acceptUnpushedWork: closeRequest.acceptUnpushedWork,
        }
      : null;
    dto.closeRefusal = closeRefusal
      ? { code: closeRefusal.code, detail: closeRefusal.detail }
      : null;
    dto.decision = this.decisionToResponse(entity.pendingDecision);
    // Retired checkouts are left out: the console renders what is on disk, and the
    // row survives only so its directory name is never reissued.
    dto.checkouts = entity.liveCheckouts.map((checkout) =>
      SessionCheckoutMapper.toResponse(checkout),
    );
    dto.cloud = entity.cloudRun ? SessionCloudRunMapper.toResponse(entity.cloudRun) : null;
    return dto;
  }

  /** The pending decision as the response states it, every nullable spelled out. */
  decisionToResponse(decision: SessionDecision | null): SessionDecisionResponseDto | null {
    if (!decision) return null;
    if (decision.kind === 'question') {
      return {
        kind: 'question',
        id: decision.id,
        questions: decision.questions.map((question) => ({
          header: question.header,
          question: question.question,
          multiSelect: question.multiSelect,
          options: question.options.map((option) => ({
            label: option.label,
            description: option.description,
          })),
        })),
      };
    }
    return {
      kind: 'permission',
      id: decision.id,
      title: decision.title,
      detail: decision.detail,
      options: decision.options.map((option) => ({ label: option.label })),
    };
  }
}

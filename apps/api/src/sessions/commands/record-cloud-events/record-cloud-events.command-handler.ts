import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { throwIfRefused } from '../../application/session-create-refusal.policy';
import { SessionPlanFactory } from '../../application/session-plan.factory';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import { adoptedCloudEntries, adoptionKey } from '../../domain/session-log-entry.factory';
import { mintSessionSlug } from '../../domain/session-slug.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_CLOUD_CHAT_REPOSITORY, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RecordCloudEventsCommand } from './record-cloud-events.command';

export interface RecordCloudEventsResult {
  /** The console's session the events are kept under; null for one closed here. */
  sessionId: string | null;
  /** How many of the events were new. */
  accepted: number;
}

/**
 * Stores events of a Claude Code cloud session's log on claude.ai, which the
 * browser extension read with the person's own sign-in, as the session's chat.
 *
 * A session this workspace does not know yet, started on claude.ai, the phone
 * or `claude --cloud`, is adopted: a cloud session with no host and no vendor
 * run, in the unassigned project, named after its claude.ai title. Adopting is
 * keyed on the claude.ai id, so two batches racing adopt it once. A session the
 * person closed here stays closed: its events are not kept again.
 */
@CommandHandler(RecordCloudEventsCommand)
export class RecordCloudEventsCommandHandler
  implements ICommandHandler<RecordCloudEventsCommand, RecordCloudEventsResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
    private readonly plan: SessionPlanFactory,
  ) {}

  async execute(command: RecordCloudEventsCommand): Promise<RecordCloudEventsResult> {
    const { scope } = command;
    if (!scope.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);

    const [known] = await this.sessions.findCloudByCloudIds(scope, [command.cloudSessionId]);
    // A session this workspace has under that id, but closed (launched here
    // or adopted), stays closed: its events are not kept, nor is it adopted again.
    if (!known && (await this.sessions.hasCloudSessionFor(scope, command.cloudSessionId))) {
      return { sessionId: null, accepted: 0 };
    }
    const session = known ?? (await this.adopt(command, scope.organizationId));
    if (!session) return { sessionId: null, accepted: 0 };
    if (known && !hasCloudChat(known)) {
      throw new AppError(SessionErrors.NO_CLOUD_CHAT, {
        detail: `Session ${known.slug} is not a Claude Code cloud session`,
      });
    }
    const accepted = await this.chat.appendEvents(
      session.organizationId,
      session.id,
      command.events,
      command.placement,
    );
    return { sessionId: session.id, accepted };
  }

  /** The adopted session, or null when the person already closed it here. */
  private async adopt(
    command: RecordCloudEventsCommand,
    organizationId: string,
  ): Promise<WorkSessionEntity | null> {
    const project = await this.plan.resolveProject(command.scope, {});
    const session = WorkSessionEntity.requestCloud({
      id: randomUUID(),
      cloudRun: null,
      organizationId,
      projectId: project.id,
      createdByUserId: command.userId,
      slug: mintSessionSlug(),
      agent: 'claude-code',
      name: command.title || undefined,
      idempotencyKey: adoptionKey(command.cloudSessionId),
    });
    const outcome = await this.sessions.createIfUnclaimed(
      session,
      adoptedCloudEntries({ userId: command.userId, cloudSessionId: command.cloudSessionId }),
    );
    throwIfRefused(outcome, { projectSlug: project.slug, hostId: null });
    if (!outcome.created && outcome.session.state === 'resolved') return null;
    return outcome.session;
  }
}

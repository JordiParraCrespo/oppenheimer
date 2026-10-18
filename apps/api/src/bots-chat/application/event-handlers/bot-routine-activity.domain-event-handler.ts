import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import type { BotRoutineRef } from '../../../automations/domain/automation-read.types';
import { AutomationRunChangedDomainEvent } from '../../../automations/domain/events/automation-run-changed.domain-event';
import { BotRoutineChangedDomainEvent } from '../../../automations/domain/events/bot-routine-changed.domain-event';
import { FindBotRoutineRefQuery } from '../../../automations/queries/find-bot-routine-ref/find-bot-routine-ref.query';
import { BOT_MESSAGE_REPOSITORY, BOT_STREAM } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import {
  type RoutineActivity,
  routineActivityLine,
  routineFailureOf,
} from '../../domain/bot-routine.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';

/**
 * The one writer of a routine's activity in its bot's chat
 * (`26-bot-routines.md` §4, "In the chat"): whatever changed a routine (the
 * bot's tool, its Routines tab, a pause the dispatcher made) raised an event,
 * and each becomes one line, keyed by the event so a redelivery writes
 * nothing twice. A run that failed to start is told the same way. The line
 * belongs to no turn: it is placed in the chat by when it happened.
 */
@Injectable()
export class BotRoutineActivityDomainEventHandler {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly queries: QueryBus,
  ) {}

  @OnEvent(BotRoutineChangedDomainEvent.name)
  async onChanged(
    event: Pick<
      BotRoutineChangedDomainEvent,
      'id' | 'aggregateId' | 'organizationId' | 'botId' | 'name' | 'activity' | 'pausedReason'
    >,
  ): Promise<void> {
    await this.write({
      id: event.id,
      organizationId: event.organizationId,
      botId: event.botId,
      automationId: event.aggregateId,
      runId: null,
      name: event.name,
      activity: event.activity,
      reason: event.pausedReason,
    });
  }

  @OnEvent(AutomationRunChangedDomainEvent.name)
  async onRun(
    event: Pick<
      AutomationRunChangedDomainEvent,
      'id' | 'aggregateId' | 'automationId' | 'outcome' | 'skipReason'
    >,
  ): Promise<void> {
    const reason = routineFailureOf(event.outcome, event.skipReason);
    if (!reason) return;
    const routine = await this.queries.execute<FindBotRoutineRefQuery, BotRoutineRef | null>(
      new FindBotRoutineRefQuery({ automationId: event.automationId }),
    );
    if (!routine) return;
    await this.write({
      id: event.id,
      organizationId: routine.organizationId,
      botId: routine.botId,
      automationId: event.automationId,
      runId: event.aggregateId,
      name: routine.name,
      activity: 'failed',
      reason,
    });
  }

  private async write(activity: RoutineActivity): Promise<void> {
    const line = routineActivityLine(activity);
    if (!(await this.messages.insertOnce(line))) return;
    await this.stream.publish(line.botId, { type: 'message', turnId: null, messageId: line.id });
  }
}

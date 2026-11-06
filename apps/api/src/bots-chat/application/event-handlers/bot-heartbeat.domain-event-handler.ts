import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { SaveBotRoutineCommand } from '../../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationListing } from '../../../automations/domain/automation-read.types';
import { FindBotRoutinesQuery } from '../../../automations/queries/find-bot-routines/find-bot-routines.query';
import { BotCreatedDomainEvent } from '../../../bots/domain/events/bot-created.domain-event';
import {
  HEARTBEAT_NAME,
  HEARTBEAT_PROMPT,
  heartbeatTrigger,
  needsHeartbeat,
} from '../../domain/bot-heartbeat.policy';
import { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';

/**
 * Gives a new bot its heartbeat (`26-bot-routines.md` §6): an hourly routine,
 * on, saved as the bot's owner within the scopes of the credential that made
 * the bot. The outbox delivers at least once, so a bot that already has one
 * gets no second; a bot whose owner is gone, or left the workspace, gets none.
 */
@Injectable()
export class BotHeartbeatDomainEventHandler {
  constructor(
    private readonly owners: BotOwnerScopeResolver,
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @OnEvent(BotCreatedDomainEvent.name)
  async handle(
    event: Pick<
      BotCreatedDomainEvent,
      'aggregateId' | 'organizationId' | 'createdByUserId' | 'credentialScopes'
    >,
  ): Promise<void> {
    const botId = event.aggregateId;
    const scope = await this.owners.resolve(event.organizationId, event.createdByUserId);
    if (!scope) return;
    const { automations } = await this.queries.execute<FindBotRoutinesQuery, AutomationListing>(
      new FindBotRoutinesQuery({ scope, botId }),
    );
    if (!needsHeartbeat(automations.map((routine) => routine.name))) return;
    await this.commands.execute(
      new SaveBotRoutineCommand({
        scope,
        botId,
        routineId: null,
        changes: {
          name: HEARTBEAT_NAME,
          prompt: HEARTBEAT_PROMPT,
          triggers: [heartbeatTrigger(botId)],
          enabled: true,
        },
        credentialScopes: event.credentialScopes,
      }),
    );
  }
}

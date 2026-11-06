import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { SaveBotRoutineCommand } from '../../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationListing } from '../../../automations/domain/automation-read.types';
import { FindBotRoutinesQuery } from '../../../automations/queries/find-bot-routines/find-bot-routines.query';
import { BotJobSetDomainEvent } from '../../../bots/domain/events/bot-job-set.domain-event';
import {
  HEARTBEAT_NAME,
  HEARTBEAT_PROMPT,
  heartbeatTrigger,
  needsHeartbeat,
} from '../../domain/bot-heartbeat.policy';
import { BotModelAccessResolver } from '../bot-model-access.resolver';
import { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';

/**
 * Gives a bot its heartbeat once it has a job (`26-bot-routines.md` §6): when
 * its `INSTRUCTIONS.md` is first written, at its creation or later, an hourly
 * routine, on, saved as the bot's owner within the scopes of the credential
 * that wrote them. A bot with no job gets none, so it never wakes to greet
 * nobody. The outbox delivers at least once, so a bot that already has one
 * gets no second; a bot that is gone, or whose owner is, gets none.
 */
@Injectable()
export class BotHeartbeatDomainEventHandler {
  constructor(
    private readonly bots: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // the relay marks the row delivered, so a failed save would leave the bot
  // without a heartbeat for good; a later edit of its job raises no second event.
  @OnEvent(BotJobSetDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<BotJobSetDomainEvent, 'organizationId' | 'botId' | 'credentialScopes'>,
  ): Promise<void> {
    const { botId } = event;
    const bot = await this.bots.findBot(event.organizationId, botId);
    if (!bot) return;
    const scope = await this.owners.resolve(event.organizationId, bot.createdByUserId);
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

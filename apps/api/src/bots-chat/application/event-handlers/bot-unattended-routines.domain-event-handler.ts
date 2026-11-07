import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { PauseUnattendedRoutinesCommand } from '../../../automations/commands/pause-unattended-routines/pause-unattended-routines.command';
import { BotRoutineChangedDomainEvent } from '../../../automations/domain/events/bot-routine-changed.domain-event';
import { BOT_NOTICE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import { BotNoticeEntity } from '../../domain/bot-notice.entity';
import { unattendedNotice } from '../../domain/bot-spend-guard.policy';

/**
 * The spend guard stopped one of a bot's routines because its owner is away
 * (`26-bot-routines.md` §6): stop the rest with it, and say so once in the
 * owner's Inbox, as an agent that stops watching a pull request says it has
 * stopped. Every routine's pause raises this; the pause is idempotent, and
 * only the pause of the routine the command names puts the line, so the
 * owner hears it once however many routines stopped.
 */
@Injectable()
export class BotUnattendedRoutinesDomainEventHandler {
  constructor(
    private readonly commands: CommandBus,
    @Inject(BOT_NOTICE_REPOSITORY) private readonly notices: BotNoticeRepositoryPort,
  ) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // the relay marks the row delivered, so a failed pause would leave the
  // bot's other routines running while its owner is away.
  @OnEvent(BotRoutineChangedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      BotRoutineChangedDomainEvent,
      'aggregateId' | 'organizationId' | 'botId' | 'activity' | 'pausedReason'
    >,
  ): Promise<void> {
    if (event.activity !== 'paused' || event.pausedReason !== 'unattended') return;
    const { organizationId, botId } = event;
    const teller = await this.commands.execute<PauseUnattendedRoutinesCommand, string | null>(
      new PauseUnattendedRoutinesCommand({ organizationId, botId }),
    );
    if (teller !== event.aggregateId) return;
    await this.notices.put(
      BotNoticeEntity.send({ organizationId, botId, text: unattendedNotice() }),
    );
  }
}

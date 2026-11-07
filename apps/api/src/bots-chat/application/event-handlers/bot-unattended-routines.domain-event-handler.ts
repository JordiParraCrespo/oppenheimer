import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { I18nService } from '@oppenheimer/backend-i18n';
import { PauseUnattendedRoutinesCommand } from '../../../automations/commands/pause-unattended-routines/pause-unattended-routines.command';
import { BotRoutineChangedDomainEvent } from '../../../automations/domain/events/bot-routine-changed.domain-event';
import type { LocaleResolverPort } from '../../../profile/application/locale-resolver.port';
import { LOCALE_RESOLVER } from '../../../profile/profile.di-tokens';
import { BOT_NOTICE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import { BotNoticeEntity } from '../../domain/bot-notice.entity';
import { ownerBackSince } from '../../domain/bot-spend-guard.policy';
import { BotModelAccessResolver } from '../bot-model-access.resolver';

/**
 * The spend guard stopped one of a bot's routines because its owner is away
 * (`26-bot-routines.md` §6): stop the rest with it, and say so once in the
 * owner's Inbox, in their language, as an agent that stops watching a pull
 * request says it has stopped. Every routine's pause raises this; the pause
 * is idempotent, and only the pause of the routine the command names puts
 * the line, so the owner hears it once however many routines stopped. An
 * owner back in the chat since the pause (the event arrived late, or was
 * retried) has already resumed them: nothing is paused again.
 */
@Injectable()
export class BotUnattendedRoutinesDomainEventHandler {
  constructor(
    private readonly commands: CommandBus,
    private readonly bots: BotModelAccessResolver,
    @Inject(BOT_NOTICE_REPOSITORY) private readonly notices: BotNoticeRepositoryPort,
    @Inject(LOCALE_RESOLVER) private readonly locales: LocaleResolverPort,
    private readonly i18n: I18nService,
  ) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // the relay marks the row delivered, so a failed pause would leave the
  // bot's other routines running while its owner is away.
  @OnEvent(BotRoutineChangedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      BotRoutineChangedDomainEvent,
      'aggregateId' | 'organizationId' | 'botId' | 'activity' | 'pausedReason' | 'metadata'
    >,
  ): Promise<void> {
    if (event.activity !== 'paused' || event.pausedReason !== 'unattended') return;
    const { organizationId, botId } = event;
    const bot = await this.bots.findBot(organizationId, botId);
    if (!bot || ownerBackSince(bot.ownerSeenAt, new Date(event.metadata.timestamp))) return;
    const teller = await this.commands.execute<PauseUnattendedRoutinesCommand, string | null>(
      new PauseUnattendedRoutinesCommand({ organizationId, botId }),
    );
    if (teller !== event.aggregateId || !bot.createdByUserId) return;
    const { locale, timeZone } = await this.locales.resolveForRecipient(bot.createdByUserId);
    const text = this.i18n.for(locale, timeZone).t('bots.routineGuard.notice');
    await this.notices.put(BotNoticeEntity.send({ organizationId, botId, text }));
  }
}

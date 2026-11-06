import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionAgentNotifiedDomainEvent } from '../../../sessions/domain/events/session-agent-notified.domain-event';
import { SessionStateChangedDomainEvent } from '../../../sessions/domain/events/session-state-changed.domain-event';
import { SessionTerminalMatchedDomainEvent } from '../../../sessions/domain/events/session-terminal-matched.domain-event';
import { SessionTurnChangedDomainEvent } from '../../../sessions/domain/events/session-turn-changed.domain-event';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import { WakeOnAgentNoticeCommand } from '../../commands/wake-on-agent-notice/wake-on-agent-notice.command';
import { WakeOnTerminalMatchCommand } from '../../commands/wake-on-terminal-match/wake-on-terminal-match.command';
import { WakeSubscribedBotCommand } from '../../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { wakeStateOf } from '../../domain/bot-subscription.policy';

/**
 * Where a session's news reaches the bots that follow it
 * (`27-bot-subscriptions.md` §1). The outbox delivers each event at least
 * once, so this only asks: each subscription's wake reads the session again
 * and is keyed so that asking twice queues one turn. A task that moved to a
 * state that wakes nobody (`queued`, `in_progress`) is not looked at; a
 * session closed is, so the subscriptions that follow it end.
 */
@Injectable()
export class BotSessionWakeDomainEventHandler {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // resolves, so the outbox would mark the event delivered and a wake that
  // failed would never be tried again.
  @OnEvent(SessionTurnChangedDomainEvent.name, { suppressErrors: false })
  async onTurn(
    event: Pick<SessionTurnChangedDomainEvent, 'aggregateId' | 'organizationId' | 'to'>,
  ): Promise<void> {
    if (!wakeStateOf(event.to)) return;
    await this.wake(event.organizationId, event.aggregateId);
  }

  @OnEvent(SessionStateChangedDomainEvent.name, { suppressErrors: false })
  async onState(
    event: Pick<SessionStateChangedDomainEvent, 'aggregateId' | 'organizationId' | 'to'>,
  ): Promise<void> {
    if (event.to !== 'resolved') return;
    await this.wake(event.organizationId, event.aggregateId);
  }

  /** A terminal watch matched: the bot that asked for it is woken, once per reported count. */
  @OnEvent(SessionTerminalMatchedDomainEvent.name, { suppressErrors: false })
  async onMatch(
    event: Pick<
      SessionTerminalMatchedDomainEvent,
      'aggregateId' | 'organizationId' | 'watchId' | 'count'
    >,
  ): Promise<void> {
    await this.commands.execute(
      new WakeOnTerminalMatchCommand({
        organizationId: event.organizationId,
        sessionId: event.aggregateId,
        watchId: event.watchId,
        count: event.count,
      }),
    );
  }

  /** The session's agent sent a line: every bot that follows the session hears it, once per notice. */
  @OnEvent(SessionAgentNotifiedDomainEvent.name, { suppressErrors: false })
  async onNotice(
    event: Pick<SessionAgentNotifiedDomainEvent, 'aggregateId' | 'organizationId' | 'noticeId'>,
  ): Promise<void> {
    await this.wakeEach(
      event.organizationId,
      event.aggregateId,
      (subscriptionId) =>
        new WakeOnAgentNoticeCommand({ subscriptionId, noticeId: event.noticeId }),
    );
  }

  /**
   * Each wake reads and decides on its own, so they run together, and one
   * that fails does not hold back the others. A failure is then thrown, for
   * the outbox to deliver the event again: the wakes that went through
   * queue nothing new the second time.
   */
  private wake(organizationId: string, sessionId: string): Promise<void> {
    return this.wakeEach(
      organizationId,
      sessionId,
      (subscriptionId) => new WakeSubscribedBotCommand({ subscriptionId }),
    );
  }

  private async wakeEach(
    organizationId: string,
    sessionId: string,
    commandFor: (subscriptionId: string) => WakeSubscribedBotCommand | WakeOnAgentNoticeCommand,
  ): Promise<void> {
    const ids = await this.subscriptions.findIdsForSession(organizationId, sessionId);
    const settled = await Promise.allSettled(
      ids.map((subscriptionId) => this.commands.execute(commandFor(subscriptionId))),
    );
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}

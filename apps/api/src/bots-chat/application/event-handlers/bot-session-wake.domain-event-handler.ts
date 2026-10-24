import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionStateChangedDomainEvent } from '../../../sessions/domain/events/session-state-changed.domain-event';
import { SessionTurnChangedDomainEvent } from '../../../sessions/domain/events/session-turn-changed.domain-event';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
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

  /**
   * Each wake reads and decides on its own, so they run together, and one
   * that fails does not hold back the others. A failure is then thrown, for
   * the outbox to deliver the event again: the wakes that went through
   * queue nothing new the second time.
   */
  private async wake(organizationId: string, sessionId: string): Promise<void> {
    const ids = await this.subscriptions.findIdsForSession(organizationId, sessionId);
    const settled = await Promise.allSettled(
      ids.map((subscriptionId) =>
        this.commands.execute(new WakeSubscribedBotCommand({ subscriptionId })),
      ),
    );
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}

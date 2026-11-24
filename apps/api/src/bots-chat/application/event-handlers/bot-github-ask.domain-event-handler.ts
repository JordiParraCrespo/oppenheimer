import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { ExternalEventReceivedDomainEvent } from '../../../inbound-events/domain/events/external-event-received.domain-event';
import { WakeOnGithubAskCommand } from '../../commands/wake-on-github-ask/wake-on-github-ask.command';
import { githubAskVia } from '../../domain/bot-github-ask.policy';

/**
 * Where an ask of a bot on GitHub comes in: a mention of Oppenheimer in a
 * comment or a review, or a `bot:` label, in the event's workspace. Our own
 * App's comments ask nothing, so a bot's answer never wakes it again. Whose
 * ask it is, and which bot it names, the command decides.
 */
@Injectable()
export class BotGithubAskDomainEventHandler {
  constructor(private readonly commands: CommandBus) {}

  // `suppressErrors: false`: a wake that failed is thrown for the outbox to
  // deliver the event again, and its key makes the second delivery one turn.
  @OnEvent(ExternalEventReceivedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      ExternalEventReceivedDomainEvent,
      | 'aggregateId'
      | 'organizationId'
      | 'source'
      | 'eventType'
      | 'actorIsOwnApp'
      | 'attributes'
      | 'metadata'
    >,
  ): Promise<void> {
    const via = githubAskVia({
      source: event.source,
      eventType: event.eventType,
      actorIsOwnApp: event.actorIsOwnApp,
      attributes: event.attributes ?? null,
    });
    if (!via) return;
    await this.commands.execute(
      new WakeOnGithubAskCommand({
        organizationId: event.organizationId,
        inboundEventId: event.aggregateId,
        via,
        metadata: { correlationId: event.metadata?.correlationId ?? undefined },
      }),
    );
  }
}

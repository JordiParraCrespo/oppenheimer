import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { InboundEventLookupPort } from '../../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../../inbound-events/inbound-events.di-tokens';
import { BotGithubAskResolver } from '../../application/bot-github-ask.resolver';
import { BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import {
  askedBot,
  githubAskEventOf,
  githubAskTurn,
  mayAskOnGithub,
} from '../../domain/bot-github-ask.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { WakeOnGithubAskCommand } from './wake-on-github-ask.command';

/**
 * An ask of a bot on GitHub. Only the workspace's owner asks: an event whose
 * GitHub login is not theirs, or that names none of their bots, queues
 * nothing and answers nothing, and what was written is read only once it is
 * known to be theirs. The answer goes back through the installation that
 * covers the repository, so with none there is no ask. The turn is keyed by
 * the stored event, so a delivery twice queues one.
 */
@CommandHandler(WakeOnGithubAskCommand)
export class WakeOnGithubAskCommandHandler
  implements ICommandHandler<WakeOnGithubAskCommand, void>
{
  private readonly logger = new Logger(WakeOnGithubAskCommandHandler.name);

  constructor(
    @Inject(INBOUND_EVENT_LOOKUP) private readonly events: InboundEventLookupPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly asks: BotGithubAskResolver,
  ) {}

  async execute(command: WakeOnGithubAskCommand): Promise<void> {
    const found = await this.events.findOne(command.organizationId, command.inboundEventId);
    if (found.isNone()) return;
    const event = found.unwrap();
    const owner = await this.asks.owner(command.organizationId);
    if (!owner || !mayAskOnGithub(event.actor.login, owner.login)) {
      return this.ignored(command, 'not_the_owner');
    }
    const bot = askedBot(await this.asks.ownBots(owner), {
      via: command.via,
      label: event.attributes.label,
      body: event.context.body,
    });
    if (!bot) return this.ignored(command, 'no_bot_named');
    const githubRepoId = Number(event.subject.ref);
    const installationId = Number.isSafeInteger(githubRepoId)
      ? await this.asks.installationCovering(owner.scope, githubRepoId)
      : null;
    if (!installationId) return this.ignored(command, 'no_installation');
    const ask = githubAskEventOf({
      via: command.via,
      installationId,
      githubRepoId: event.subject.ref,
      repository: event.subject.name,
      attributes: event.attributes,
      url: event.context.url,
      actorLogin: event.actor.login,
    });
    if (!ask) return this.ignored(command, 'no_place_to_answer');

    const { turn, opening } = githubAskTurn(bot, owner.userId, {
      inboundEventId: event.id,
      event: ask,
      label: typeof event.attributes.label === 'string' ? event.attributes.label : null,
      context: event.context,
    });
    const queued = await this.turns.enqueueOnce(
      turn,
      opening,
      command.metadata.correlationId ?? null,
      null,
    );
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
  }

  private ignored(command: WakeOnGithubAskCommand, reason: string): void {
    this.logger.log({
      message: 'An ask on GitHub was ignored',
      organizationId: command.organizationId,
      inboundEventId: command.inboundEventId,
      via: command.via,
      reason,
    });
  }
}

import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotGoalResolver } from '../../application/bot-goal.resolver';
import { BOT_GOAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import { ResumeBotGoalCommand } from './resume-bot-goal.command';

/**
 * Resume a bot's paused goal from its chat (`25-bots.md` §4.1): it runs again
 * from where it paused, with its count, its spend and its history, and its
 * next continuation is queued with a line saying the owner resumed it. One
 * whose pausing turn has not ended yet is resumed in place, and that turn's
 * end counts it and goes on (`resumeBeforeItsTurnEnds`). A
 * goal that is not paused, or none, changes nothing; one whose budget is
 * spent pauses again after the turn, so the budget still holds. A goal whose
 * owner can no longer act stops, as it would have on its next turn, and one
 * set with a limit that has none left ends.
 */
@CommandHandler(ResumeBotGoalCommand)
export class ResumeBotGoalCommandHandler implements ICommandHandler<ResumeBotGoalCommand, void> {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    private readonly goalsOf: BotGoalResolver,
  ) {}

  async execute({ scope, botId, metadata }: ResumeBotGoalCommand): Promise<void> {
    const bot = await this.lookup.bot(scope, botId);
    const goal = await this.goals.findForBot(bot.organizationId, bot.id);
    if (!goal?.paused) return;
    // Its pausing turn still owes its end: resumed in place, that end goes on.
    if (await this.goalsOf.resumeBeforeItsTurnEnds(goal)) return;
    // A goal set with a limit before 2026-11-09 that paused on its last
    // continuation has none left to queue: it ends, as it would have.
    if (goal.exhausted) {
      await this.goalsOf.end(goal, { activity: 'exhausted', reason: null }, metadata.correlationId);
      return;
    }
    const props = await this.goalsOf.continuationProps(goal);
    if (!props) {
      await this.goalsOf.end(
        goal,
        { activity: 'stopped', reason: 'access_lost' },
        metadata.correlationId,
      );
      return;
    }
    goal.resume();
    await this.goalsOf.queueContinuation(goal, props, null, false, metadata.correlationId, true);
  }
}

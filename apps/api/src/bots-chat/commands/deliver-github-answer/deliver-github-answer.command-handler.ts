import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AddAppIssueCommentCommand } from '../../../github/commands/add-app-issue-comment/add-app-issue-comment.command';
import { BotOwnerScopeResolver } from '../../application/bot-owner-scope.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { unsentTexts } from '../../domain/bot-channel-turn.policy';
import { githubAnswerOf } from '../../domain/bot-github-ask.policy';
import { DeliverGithubAnswerCommand } from './deliver-github-answer.command';

/**
 * An ask on GitHub is answered where it was made: the turn's last text, or
 * what happened to it, as one comment of Oppenheimer's App on the issue or
 * pull request its opening line names, posted in the owner's scope. The job
 * is not retried, so an answer is not posted twice; one GitHub refused is
 * logged, and the chat still has it.
 */
@CommandHandler(DeliverGithubAnswerCommand)
export class DeliverGithubAnswerCommandHandler
  implements ICommandHandler<DeliverGithubAnswerCommand, void>
{
  private readonly logger = new Logger(DeliverGithubAnswerCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly owners: BotOwnerScopeResolver,
    private readonly commands: CommandBus,
  ) {}

  async execute({ turnId, metadata }: DeliverGithubAnswerCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (turn.origin !== 'github' || !turn.ended) return;
    const opening = await this.messages.findOpening(turn.organizationId, turn.id);
    const ask = opening?.event?.kind === 'github_ask' ? opening.event : null;
    const scope = await this.owners.resolve(turn.organizationId, turn.requestedByUserId);
    if (!ask || !scope) return;
    const lines = await this.messages.findTurnLines(turn.organizationId, turn.id);
    const body = githubAnswerOf(turn, unsentTexts(lines, false));
    try {
      await this.commands.execute(
        new AddAppIssueCommentCommand({
          scope,
          address: {
            kind: 'installation',
            installationId: ask.installationId,
            githubRepoId: Number(ask.githubRepoId),
            number: ask.number,
          },
          body,
          metadata: { correlationId: metadata.correlationId },
        }),
      );
    } catch (error) {
      this.logger.error(
        { message: 'A bot could not answer on GitHub', turnId, botId: turn.botId },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

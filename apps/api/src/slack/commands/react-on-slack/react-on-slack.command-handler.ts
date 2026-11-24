import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SlackBotAppResolver } from '../../application/slack-bot-app.resolver';
import { SLACK_WORKING_REACTION, SlackLineResolver } from '../../application/slack-line.resolver';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackErrors } from '../../domain/slack.errors';
import type { SlackAccountEntity } from '../../domain/slack-account.entity';
import { slackReactionName } from '../../domain/slack-reaction.policy';
import { slackThreadOf } from '../../domain/slack-text.policy';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { ReactOnSlackCommand, type SlackReactOutcome } from './react-on-slack.command';

/**
 * Reacts to the owner's message as the bot's app while it is connected and
 * still this bot's, by Slack's name for the emoji (`slackReactionName`): an
 * emoji with none is `no_name`, before anything is sent. The bot's reaction
 * before it comes off once the new one is on, so the message carries one of
 * the bot's at a time; when that removal fails, the new one is taken back
 * off and it is `not_sent`, so Slack and the console both keep the old one. 👀 is the app's working sign (`SLACK_WORKING_REACTION`), which the
 * turn's end takes off, so a bot's own would vanish with it: `working_sign`.
 * A call Slack refuses (the app made before `reactions:write`, the
 * message deleted) is `not_sent`, logged; a token it refuses marks the app
 * `revoked`, as a reply does.
 */
@CommandHandler(ReactOnSlackCommand)
export class ReactOnSlackCommandHandler
  implements ICommandHandler<ReactOnSlackCommand, SlackReactOutcome>
{
  private readonly logger = new Logger(ReactOnSlackCommandHandler.name);

  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly apps: SlackBotAppResolver,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(command: ReactOnSlackCommand): Promise<SlackReactOutcome> {
    const name = command.emoji === null ? null : slackReactionName(command.emoji);
    if (command.emoji !== null && !name) return 'no_name';
    if (name === SLACK_WORKING_REACTION) return 'working_sign';
    const thread = slackThreadOf(command.chatId);
    if (!thread) return 'not_sent';
    const account = await this.apps.answering(
      command.organizationId,
      command.accountId,
      command.botId,
    );
    if (!account) return 'not_sent';
    const before = command.previous === null ? null : slackReactionName(command.previous);
    const message = { channel: thread.channel, ts: command.ts };
    // The new one goes on first: an add that fails leaves the old one, which
    // the console still shows, so the two agree.
    if (name && !(await this.sent(account, message, name, true))) return 'not_sent';
    if (!before || before === name) return 'reacted';
    if (await this.sent(account, message, before, false)) return 'reacted';
    // The old one stayed: take the new one back off, so Slack keeps what
    // the console keeps, and the old one is still `previous` to clear later.
    if (name) await this.sent(account, message, name, false);
    return 'not_sent';
  }

  private async sent(
    account: SlackAccountEntity,
    message: { channel: string; ts: string },
    name: string,
    on: boolean,
  ): Promise<boolean> {
    try {
      await this.lines.react(account, message, name, on);
      return true;
    } catch (error) {
      await this.refused(account, error);
      return false;
    }
  }

  private async refused(account: SlackAccountEntity, error: unknown): Promise<void> {
    if (error instanceof AppError && error.code === SlackErrors.TOKEN_REFUSED.code) {
      account.revoke(error.detail ?? SlackErrors.TOKEN_REFUSED.message);
      await this.accounts.saveStatus(account);
    }
    this.logger.warn({
      message: 'A Slack reaction was not sent',
      accountId: account.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
